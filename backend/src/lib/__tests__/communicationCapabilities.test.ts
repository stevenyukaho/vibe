import { extractCapabilityName, serializeCapabilities } from '../communicationCapabilities';

describe('communicationCapabilities', () => {
	describe('extractCapabilityName', () => {
		it('extracts name from JSON capability', () => {
			expect(extractCapabilityName('{"name": "openai-chat"}')).toBe('openai-chat');
			expect(extractCapabilityName('{"name": "ollama-generate"}')).toBe('ollama-generate');
		});

		it('extracts name from legacy schema JSON', () => {
			expect(extractCapabilityName('{"schema": "legacy-cap"}')).toBe('legacy-cap');
		});

		it('handles plain string capability', () => {
			expect(extractCapabilityName('openai-chat')).toBe('openai-chat');
			expect(extractCapabilityName('simple-name')).toBe('simple-name');
		});

		it('handles null/empty capability', () => {
			expect(extractCapabilityName(null)).toBeNull();
			expect(extractCapabilityName(undefined)).toBeNull();
			expect(extractCapabilityName('')).toBeNull();
		});

		it('handles whitespace-only capability', () => {
			expect(extractCapabilityName('   ')).toBeNull();
			expect(extractCapabilityName('\n\t')).toBeNull();
			expect(extractCapabilityName('  \n  ')).toBeNull();
		});

		it('handles malformed JSON by returning as-is', () => {
			expect(extractCapabilityName('{invalid')).toBe('{invalid');
			expect(extractCapabilityName('{"incomplete"')).toBe('{"incomplete"');
		});

		it('handles JSON without name or schema property', () => {
			expect(extractCapabilityName('{"type": "openai"}')).toBeNull();
			expect(extractCapabilityName('{}')).toBeNull();
			expect(extractCapabilityName('{"other": "value"}')).toBeNull();
		});

		it('prefers name over schema when both present', () => {
			expect(extractCapabilityName('{"name": "primary", "schema": "secondary"}')).toBe('primary');
		});

		it('handles JSON with extra whitespace', () => {
			expect(extractCapabilityName('  {"name": "openai-chat"}  ')).toBe('openai-chat');
			expect(extractCapabilityName('\n{"name": "test"}\n')).toBe('test');
		});

		it('handles nested JSON objects', () => {
			expect(extractCapabilityName('{"name": "test", "config": {"key": "value"}}')).toBe('test');
		});

		it('handles empty name in JSON', () => {
			// Empty strings are returned as-is by extractCapabilityName
			expect(extractCapabilityName('{"name": ""}')).toBe('');
			expect(extractCapabilityName('{"schema": ""}')).toBe('');
		});
	});

	describe('serializeCapabilities', () => {
		it('converts plain string to JSON format', () => {
			expect(serializeCapabilities('openai-chat')).toBe('{"name":"openai-chat"}');
			expect(serializeCapabilities('ollama-generate')).toBe('{"name":"ollama-generate"}');
		});

		it('handles null/undefined', () => {
			expect(serializeCapabilities(null)).toBeNull();
			expect(serializeCapabilities(undefined)).toBeNull();
		});

		it('handles empty string', () => {
			expect(serializeCapabilities('')).toBeNull();
			expect(serializeCapabilities('   ')).toBeNull();
		});

		it('handles object with name property', () => {
			expect(serializeCapabilities({ name: 'openai-chat' })).toBe('{"name":"openai-chat"}');
		});

		it('handles object with legacy schema property', () => {
			expect(serializeCapabilities({ schema: 'legacy-cap' })).toBe('{"name":"legacy-cap"}');
		});

		it('prefers name over schema in object', () => {
			expect(serializeCapabilities({ name: 'primary', schema: 'secondary' })).toBe('{"name":"primary"}');
		});

		it('handles JSON string with name', () => {
			expect(serializeCapabilities('{"name": "openai-chat"}')).toBe('{"name":"openai-chat"}');
		});

		it('handles JSON string with schema', () => {
			expect(serializeCapabilities('{"schema": "legacy"}')).toBe('{"name":"legacy"}');
		});

		it('returns null for JSON without name or schema', () => {
			expect(serializeCapabilities('{"type": "openai"}')).toBeNull();
			expect(serializeCapabilities('{}')).toBeNull();
		});

		it('handles invalid JSON string as capability name', () => {
			expect(serializeCapabilities('{invalid')).toBe('{"name":"{invalid"}');
		});

		it('handles object without name or schema', () => {
			expect(serializeCapabilities({ type: 'openai' })).toBeNull();
			expect(serializeCapabilities({})).toBeNull();
		});

		it('handles whitespace in plain string', () => {
			expect(serializeCapabilities('  openai-chat  ')).toBe('{"name":"openai-chat"}');
		});

		it('handles non-string name in object', () => {
			expect(serializeCapabilities({ name: 123 })).toBeNull();
			expect(serializeCapabilities({ name: null })).toBeNull();
			expect(serializeCapabilities({ name: undefined })).toBeNull();
		});

		it('handles non-string schema in object', () => {
			expect(serializeCapabilities({ schema: 456 })).toBeNull();
		});

		it('handles JSON string with extra properties', () => {
			expect(serializeCapabilities('{"name": "test", "version": "1.0"}')).toBe('{"name":"test"}');
		});

		it('handles empty name in JSON string', () => {
			expect(serializeCapabilities('{"name": ""}')).toBeNull();
		});

		it('handles whitespace-only name in JSON string', () => {
			// Whitespace-only names are preserved in the JSON
			expect(serializeCapabilities('{"name": "   "}')).toBe('{"name":"   "}');
		});

		it('handles number input', () => {
			expect(serializeCapabilities(123)).toBeNull();
		});

		it('handles boolean input', () => {
			expect(serializeCapabilities(true)).toBeNull();
			expect(serializeCapabilities(false)).toBeNull();
		});

		it('handles array input', () => {
			expect(serializeCapabilities([])).toBeNull();
			expect(serializeCapabilities(['openai-chat'])).toBeNull();
		});
	});
});

// Made with Bob
