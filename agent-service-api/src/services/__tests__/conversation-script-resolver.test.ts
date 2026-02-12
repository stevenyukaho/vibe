import {
	resolveConversationScript,
	validateConversationRequirements,
	type AgentConfig,
	type ConversationScriptMessage
} from '../conversation-script-resolver';

describe('conversation-script-resolver', () => {
	it('resolves effective template/map and merges variables', () => {
		const conversation = {
			id: 10,
			name: 'Conversation',
			variables: JSON.stringify({ tenantId: 'org-1' }),
			messages: [
				{
					id: 1,
					conversation_id: 10,
					sequence: 1,
					role: 'user',
					content: 'Hi',
					set_variables: JSON.stringify({ requestId: 'req-1' })
				}
			]
		} as any;

		const agentConfig: AgentConfig = {
			templates: [{ id: 2, body: '{"input":"{{input}}"}', is_default: 1, capabilities: '{"name":"chat"}' }],
			maps: [{ id: 3, spec: '{"output":"data.text"}', is_default: 1, capabilities: '{"name":"chat"}' }],
			defaultTemplate: { id: 2, body: '{"input":"{{input}}"}', is_default: 1, capabilities: '{"name":"chat"}' },
			defaultMap: { id: 3, spec: '{"output":"data.text"}', is_default: 1, capabilities: '{"name":"chat"}' }
		};

		const script = resolveConversationScript(conversation, agentConfig);
		const userMessage = script[0] as ConversationScriptMessage;

		expect(userMessage.metadata?.request_template).toBe('{"input":"{{input}}"}');
		expect(userMessage.metadata?.response_mapping).toBe('{"output":"data.text"}');
		expect(userMessage.metadata?.variables).toEqual({
			tenantId: 'org-1',
			requestId: 'req-1'
		});
	});

	it('throws when required request capability does not match', () => {
		const conversation = {
			id: 10,
			name: 'Conversation',
			required_request_template_capabilities: '{"name":"required-cap"}'
		} as any;

		const resolvedMessages: ConversationScriptMessage[] = [
			{
				id: 1,
				conversation_id: 10,
				sequence: 1,
				role: 'user',
				content: 'Hello',
				metadata: {
					request_capabilities: { name: 'different-cap' }
				}
			} as any
		];

		expect(() => validateConversationRequirements(conversation, resolvedMessages)).toThrow(
			'Request template capabilities do not satisfy conversation requirements'
		);
	});
});
