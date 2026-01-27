import type { ExecutionSession, SessionMessage, TestResult } from '@ibm-vibe/types';
import { legacyResultToSession, sessionToLegacyResult } from '../legacy-adapter';

describe('legacy adapter', () => {
	it('converts execution sessions into legacy results with assistant similarity data', () => {
		const session: ExecutionSession = {
			id: 42,
			conversation_id: 7,
			agent_id: 3,
			status: 'completed',
			started_at: '2025-12-01T10:00:00.000Z',
			completed_at: '2025-12-01T10:00:01.250Z',
			success: true,
			metadata: JSON.stringify({
				intermediate_steps: [{ action: 'call', output: 'step' }],
				input_tokens: 12,
				output_tokens: 4,
				token_mapping_metadata: '{"source":"test"}'
			})
		};

		const sessionMessages: SessionMessage[] = [
			{
				id: 1,
				session_id: 42,
				sequence: 1,
				role: 'user',
				content: 'hello'
			},
			{
				id: 2,
				session_id: 42,
				sequence: 2,
				role: 'assistant',
				content: 'hi there',
				similarity_score: 88,
				similarity_scoring_status: 'completed',
				similarity_scoring_metadata: '{"engine":"mock"}'
			}
		];

		const legacy = sessionToLegacyResult(session, sessionMessages);

		expect(legacy.test_id).toBe(7);
		expect(legacy.output).toBe('hi there');
		expect(legacy.execution_time).toBe(1250);
		expect(legacy.intermediate_steps).toContain('step');
		expect(legacy.similarity_score).toBe(88);
		expect(legacy.similarity_scoring_status).toBe('completed');
		expect(legacy.input_tokens).toBe(12);
		expect(legacy.output_tokens).toBe(4);
	});

	it('creates session payloads from legacy results', () => {
		const result: TestResult = {
			id: 9,
			agent_id: 2,
			test_id: 5,
			output: 'Answer',
			intermediate_steps: JSON.stringify([{ output: 'step' }]),
			success: true,
			execution_time: 900,
			created_at: '2025-12-01T10:00:00.000Z'
		};

		const { session, messages } = legacyResultToSession(result, 'Prompt');

		expect(session.agent_id).toBe(2);
		expect(session.conversation_id).toBe(5);
		expect(messages).toHaveLength(2);
		expect(messages[0]).toMatchObject({ role: 'user', content: 'Prompt' });
		expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Answer' });
	});

	it('handles missing assistant message in sessionToLegacyResult', () => {
		const session: ExecutionSession = {
			id: 10,
			conversation_id: 3,
			agent_id: 1,
			status: 'failed',
			started_at: '2025-12-01T10:00:00.000Z',
			completed_at: '2025-12-01T10:00:01.000Z',
			success: false
		};

		const legacy = sessionToLegacyResult(session, []);

		expect(legacy.output).toBe('');
		expect(legacy.similarity_score).toBeUndefined();
	});

	it('handles missing timestamps in sessionToLegacyResult', () => {
		const session: ExecutionSession = {
			id: 11,
			conversation_id: 4,
			agent_id: 2,
			status: 'pending',
			success: false
		};

		const legacy = sessionToLegacyResult(session, []);

		expect(legacy.execution_time).toBeUndefined();
	});

	it('handles malformed metadata JSON in sessionToLegacyResult', () => {
		const session: ExecutionSession = {
			id: 12,
			conversation_id: 5,
			agent_id: 3,
			status: 'completed',
			success: true,
			metadata: 'invalid json{'
		};

		const legacy = sessionToLegacyResult(session, []);

		expect(legacy.intermediate_steps).toBe('');
		expect(legacy.input_tokens).toBeUndefined();
	});

	it('handles intermediate_steps as object in sessionToLegacyResult', () => {
		const session: ExecutionSession = {
			id: 13,
			conversation_id: 6,
			agent_id: 4,
			status: 'completed',
			success: true,
			metadata: JSON.stringify({
				intermediate_steps: { action: 'test', result: 'data' }
			})
		};

		const legacy = sessionToLegacyResult(session, []);

		expect(legacy.intermediate_steps).toBe('{"action":"test","result":"data"}');
	});

	it('handles missing similarity data on assistant message', () => {
		const session: ExecutionSession = {
			id: 14,
			conversation_id: 7,
			agent_id: 5,
			status: 'completed',
			success: true
		};

		const sessionMessages: SessionMessage[] = [
			{
				id: 1,
				session_id: 14,
				sequence: 1,
				role: 'user',
				content: 'question'
			},
			{
				id: 2,
				session_id: 14,
				sequence: 2,
				role: 'assistant',
				content: 'answer'
			}
		];

		const legacy = sessionToLegacyResult(session, sessionMessages);

		expect(legacy.similarity_score).toBeUndefined();
		expect(legacy.similarity_scoring_status).toBeUndefined();
	});

	it('preserves all token metadata fields', () => {
		const session: ExecutionSession = {
			id: 15,
			conversation_id: 8,
			agent_id: 6,
			status: 'completed',
			success: true,
			metadata: JSON.stringify({
				input_tokens: 100,
				output_tokens: 50,
				token_mapping_metadata: '{"provider":"openai"}'
			})
		};

		const legacy = sessionToLegacyResult(session, []);

		expect(legacy.input_tokens).toBe(100);
		expect(legacy.output_tokens).toBe(50);
		expect(legacy.token_mapping_metadata).toBe('{"provider":"openai"}');
	});

	it('handles failed similarity scoring on assistant message', () => {
		const session: ExecutionSession = {
			id: 16,
			conversation_id: 9,
			agent_id: 7,
			status: 'completed',
			success: true
		};

		const sessionMessages: SessionMessage[] = [
			{
				id: 1,
				session_id: 16,
				sequence: 1,
				role: 'assistant',
				content: 'response',
				similarity_scoring_status: 'failed',
				similarity_scoring_error: 'API timeout'
			}
		];

		const legacy = sessionToLegacyResult(session, sessionMessages);

		expect(legacy.similarity_scoring_status).toBe('failed');
		expect(legacy.similarity_scoring_error).toBe('API timeout');
		expect(legacy.similarity_score).toBeUndefined();
	});

	it('includes all similarity metadata in legacyResultToSession', () => {
		const result: TestResult = {
			agent_id: 8,
			test_id: 10,
			output: 'result',
			success: true,
			similarity_score: 95,
			similarity_scoring_status: 'completed',
			similarity_scoring_metadata: '{"engine":"test"}',
			input_tokens: 20,
			output_tokens: 10
		};

		const { session } = legacyResultToSession(result, 'input');
		const metadata = JSON.parse(session.metadata!);

		expect(metadata.similarity_score).toBe(95);
		expect(metadata.similarity_scoring_status).toBe('completed');
		expect(metadata.similarity_scoring_metadata).toBe('{"engine":"test"}');
		expect(metadata.input_tokens).toBe(20);
		expect(metadata.output_tokens).toBe(10);
	});
});
