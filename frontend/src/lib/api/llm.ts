import type { LLMConfig, LLMRequestOptions, LLMResponse } from './types';
import { API_URL, fetchJson } from './fetchJson';

export const llmApi = {
	async getLLMConfigs(): Promise<LLMConfig[]> {
		return fetchJson<LLMConfig[]>(`${API_URL}/api/llm-configs`, undefined, 'Failed to fetch LLM configs');
	},

	async getLLMConfigById(id: number): Promise<LLMConfig> {
		return fetchJson<LLMConfig>(`${API_URL}/api/llm-configs/${id}`, undefined, 'Failed to fetch LLM config');
	},

	async createLLMConfig(config: Omit<LLMConfig, 'id' | 'created_at' | 'updated_at'>): Promise<LLMConfig> {
		return fetchJson<LLMConfig>(
			`${API_URL}/api/llm-configs`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			},
			'Failed to create LLM config'
		);
	},

	async updateLLMConfig(id: number, config: Partial<LLMConfig>): Promise<LLMConfig> {
		return fetchJson<LLMConfig>(
			`${API_URL}/api/llm-configs/${id}`,
			{
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			},
			'Failed to update LLM config'
		);
	},

	async deleteLLMConfig(id: number): Promise<void> {
		await fetchJson<void>(`${API_URL}/api/llm-configs/${id}`, { method: 'DELETE' }, 'Failed to delete LLM config');
	},

	async callLLM(id: number, options: LLMRequestOptions): Promise<LLMResponse> {
		return fetchJson<LLMResponse>(
			`${API_URL}/api/llm-configs/${id}/call`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(options)
			},
			'Failed to call LLM'
		);
	},

	async callLLMWithFallback(options: LLMRequestOptions): Promise<LLMResponse> {
		return fetchJson<LLMResponse>(
			`${API_URL}/api/llm-configs/call`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(options)
			},
			'Failed to call LLM with fallback'
		);
	}
};
