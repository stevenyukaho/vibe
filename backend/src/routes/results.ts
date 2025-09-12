import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	getExecutionSessionsWithCount,
	getExecutionSessionById,
	getSessionMessages,
	getConversationById,
	createExecutionSession,
	addSessionMessage
} from '../db/queries';
import type { TestResult } from '../types';
import { scoringService } from '../services/scoring-service';
import { paginationConfig } from '../config';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';
import { extractTokenUsage, validateTokenUsage } from '../lib/tokenUsageExtractor';
import {
	sessionToLegacyResult,
	legacyResultToSession,
	conversationToLegacyTest
} from '../adapters/legacy-adapter';
import { testIdToConversationId } from '../lib/legacyIdResolver';

const router = Router();

// Get all results (from execution sessions)
router.get('/', (async (req: Request, res: Response) => {
	try {
		const { agent_id, test_id } = req.query as { agent_id?: string; test_id?: string };

		// Map legacy filters to session filters
		const baseFilters: { agent_id?: number; conversation_id?: number } = {
			...(agent_id ? { agent_id: Number(agent_id) } : {}),
			...(test_id ? { conversation_id: Number(test_id) } : {}) // Map test_id to conversation_id TODO deprecate this
		};

		// If client supplied pagination, honor it
		if (hasPaginationParams(req)) {
			const paginationParams = validatePaginationOrError(req, res);
			if (!paginationParams) {
				return;
			}

			const { data, total } = getExecutionSessionsWithCount({ ...baseFilters, ...paginationParams });

			// Transform sessions to legacy results format
			const legacyResults = await Promise.all(
				data.map(async (session) => {
					const sessionMessages = await getSessionMessages(session.id!);
					return sessionToLegacyResult(session, sessionMessages);
				})
			);

			return res.json({
				data: legacyResults,
				total,
				limit: paginationParams.limit,
				offset: paginationParams.offset || 0
			});
		}

		// Otherwise fall back to default pagination limit for large tables
		const defaultLimit = paginationConfig.defaultLargeLimit;
		const { data, total } = getExecutionSessionsWithCount({
			...baseFilters,
			limit: defaultLimit,
			offset: 0
		});

		// Transform sessions to legacy results format
		const legacyResults = await Promise.all(
			data.map(async (session) => {
				const sessionMessages = await getSessionMessages(session.id!);
				return sessionToLegacyResult(session, sessionMessages);
			})
		);

		return res.json({
			data: legacyResults,
			total,
			limit: defaultLimit,
			offset: 0
		});
	} catch (error) {
		console.error('Error fetching results:', error);
		return res.status(500).json({ error: 'Failed to fetch results' });
	}
}) as any);

// Get result by ID (from execution session)
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);
		const session = await getExecutionSessionById(sessionId);

		if (!session) {
			return res.status(404).json({ error: 'Result not found' });
		}

		const sessionMessages = await getSessionMessages(sessionId);
		const legacyResult = sessionToLegacyResult(session, sessionMessages);

		return res.json(legacyResult);
	} catch (error) {
		console.error('Error fetching result:', error);
		return res.status(500).json({ error: 'Failed to fetch result' });
	}
}) as any);

// Create new result (as execution session)
router.post('/', (async (req: Request<{}, {}, Omit<TestResult, 'id' | 'created_at'>>, res: Response) => {
	try {
		let processedBody = { ...req.body };

		// If token data isn't provided but we have intermediate steps, try to extract it
		if (
			!processedBody.input_tokens
			&& !processedBody.output_tokens
			&& processedBody.intermediate_steps
		) {
			try {
				const { tokens, metadata } = extractTokenUsage(null, undefined, processedBody.intermediate_steps);
				const validatedTokens = validateTokenUsage(tokens);

				if (validatedTokens.input_tokens !== undefined || validatedTokens.output_tokens !== undefined) {
					processedBody.input_tokens = validatedTokens.input_tokens;
					processedBody.output_tokens = validatedTokens.output_tokens;
					processedBody.token_mapping_metadata = JSON.stringify({
						...metadata,
						processed_during_result_creation: true,
						timestamp: new Date().toISOString()
					});
				}
			} catch (error) {
				console.warn('Failed to extract token usage from intermediate steps:', error);
			}
		} else if (processedBody.input_tokens !== undefined || processedBody.output_tokens !== undefined) {
			const tokens = {
				input_tokens: processedBody.input_tokens,
				output_tokens: processedBody.output_tokens
			};
			const validatedTokens = validateTokenUsage(tokens);
			processedBody.input_tokens = validatedTokens.input_tokens;
			processedBody.output_tokens = validatedTokens.output_tokens;
		}

		// Resolve legacy id mapping and fetch conversation for the test input
		const conversationId = testIdToConversationId(processedBody.test_id) ?? processedBody.test_id;
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Test not found' });
		}

		const legacyTest = conversationToLegacyTest(conversation, []);
		const { session, messages } = legacyResultToSession({ ...processedBody, test_id: conversationId }, legacyTest.input);

		const createdSession = await createExecutionSession(session);

		// Add session messages
		const createdMessages = [];
		for (const message of messages) {
			const createdMessage = await addSessionMessage({
				session_id: createdSession.id!,
				...message
			});
			createdMessages.push(createdMessage);
		}

		// Transform back to legacy result format for response
		const legacyResult = sessionToLegacyResult(createdSession, createdMessages);

		const formattedResult = {
			...legacyResult,
			input_tokens: legacyResult.input_tokens ?? undefined,
			output_tokens: legacyResult.output_tokens ?? undefined
		};

		// Trigger scoring if there's an expected output
		if (conversation.expected_outcome) {
			const testForScoring = conversationToLegacyTest(conversation, []);
			scoringService.scoreTestResult(formattedResult, testForScoring).catch(error => {
				console.error(`Failed to score result ${legacyResult.id}:`, error);
			});
		}

		return res.status(201).json(formattedResult);
	} catch (error) {
		console.error('Error creating result:', error);
		return res.status(500).json({ error: 'Failed to create result' });
	}
}) as any);

router.post('/:id/score', (async (req: Request<{ id: string }, {}, { llm_config_id?: number }>, res: Response) => {
	try {
		const sessionId = Number(req.params.id);
		if (isNaN(sessionId)) {
			return res.status(400).json({ error: 'Invalid result ID' });
		}

		const session = await getExecutionSessionById(sessionId);
		if (!session) {
			return res.status(404).json({ error: 'Result not found' });
		}

		const conversation = await getConversationById(session.conversation_id);
		if (!conversation) {
			return res.status(404).json({ error: 'Associated test not found' });
		}

		if (!conversation.expected_outcome) {
			return res.status(400).json({ error: 'Test has no expected output to score against' });
		}

		const { llm_config_id } = req.body;

		// Transform session to legacy result for scoring
		const sessionMessages = await getSessionMessages(sessionId);
		const legacyResult = sessionToLegacyResult(session, sessionMessages);
		const legacyTest = conversationToLegacyTest(conversation, []);

		scoringService.scoreTestResult(legacyResult, legacyTest, llm_config_id).catch(error => {
			console.error(`Failed to score result ${legacyResult.id}:`, error);
		});

		return res.status(202).json({
			message: 'Scoring initiated',
			result_id: sessionId
		});
	} catch (error) {
		console.error('Error initiating scoring:', error);
		return res.status(500).json({ error: 'Failed to initiate scoring' });
	}
}) as any);

export default router;
