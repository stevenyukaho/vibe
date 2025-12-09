import type { Conversation, ConversationMessage } from '@ibm-vibe/types';
import { JobPollerService } from '../job-poller';

const buildConversation = (): Conversation & { messages: ConversationMessage[] } => ({
	id: 1,
	name: 'Test conversation',
	description: 'baseline',
	default_request_template_id: 2,
	default_response_map_id: 3,
	variables: JSON.stringify({ global: 'value' }),
	created_at: '',
	updated_at: '',
	stop_on_failure: false,
	messages: [
		{
			id: 10,
			conversation_id: 1,
			sequence: 1,
			role: 'user',
			content: 'Hello',
			request_template_id: 4,
			response_map_id: 5,
			set_variables: JSON.stringify({ local: 'scope' })
		}
	]
});

const agentConfig = {
	templates: [
		{ id: 4, body: '{"input":"{{content}}"}', is_default: 0 },
		{ id: 2, body: '{"input":"default"}', is_default: 1 }
	],
	maps: [
		{ id: 5, spec: '{"output":"$.result"}', is_default: 0 },
		{ id: 3, spec: '{"output":"$.default"}', is_default: 1 }
	],
	defaultTemplate: { id: 2, body: '{"input":"default"}', is_default: 1 },
	defaultMap: { id: 3, spec: '{"output":"$.default"}', is_default: 1 }
};

describe('JobPollerService conversation script resolution', () => {
	it('merges templates, response maps, and variables', () => {
		const poller = new JobPollerService('http://example.com', 'test-service');
		const conversation = buildConversation();

		const resolvedScript = (poller as unknown as { resolveConversationScript: Function })
			.resolveConversationScript(conversation, agentConfig);

		expect(resolvedScript).toHaveLength(1);
		const [message] = resolvedScript;
		expect(message.metadata?.request_template).toContain('{{content}}');
		expect(message.metadata?.response_mapping).toContain('$.result');
		expect(message.metadata?.variables).toMatchObject({ global: 'value', local: 'scope' });
	});
});
