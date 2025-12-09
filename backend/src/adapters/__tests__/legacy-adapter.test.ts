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
});
