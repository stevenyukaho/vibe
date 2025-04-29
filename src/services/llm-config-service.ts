import axios from 'axios';
import { LLMConfig } from '../types';
import { getLLMConfigs, getLLMConfigById } from '../db/queries';

export interface LLMRequestOptions {
	prompt: string;
	max_tokens?: number;
	temperature?: number;
	stop?: string[];
}

export interface LLMResponse {
	text: string;
	provider: string;
	model: string;
	config_id: number;
	error?: string;
}

/**
 * Service for managing LLM configs and making LLM requests
 */
export class LLMConfigService {
	/**
	 * Get all LLM configs in priority order
	 */
	getConfigs(): LLMConfig[] {
		return getLLMConfigs();
	}

	/**
	 * Get a specific LLM config by ID
	 */
	getConfigById(id: number): LLMConfig {
		return getLLMConfigById(id);
	}

	/**
	 * Call a specific LLM config by ID
	 */
	async callLLM(configId: number, options: LLMRequestOptions): Promise<LLMResponse> {
		const config = this.getConfigById(configId);
		if (!config) {
			throw new Error(`LLM config with ID ${configId} not found`);
		}

		try {
			return await this.makeLLMRequest(config, options);
		} catch (error: any) {
			return {
				text: '',
				provider: config.provider,
				model: JSON.parse(config.config).model || 'unknown',
				config_id: config.id || 0,
				error: error.message || 'Unknown error'
			};
		}
	}

	/**
	 * Call LLMs in priority order until one succeeds
	 */
	async callLLMWithFallback(options: LLMRequestOptions): Promise<LLMResponse> {
		const configs = this.getConfigs();
		
		if (configs.length === 0) {
			throw new Error('No LLM configs available');
		}

		// Try each config in priority order
		const errors: string[] = [];
		
		for (const config of configs) {
			try {
				return await this.makeLLMRequest(config, options);
			} catch (error: any) {
				errors.push(`${config.provider} (${config.id}): ${error.message}`);
			}
		}

		throw new Error(`All LLM requests failed: ${errors.join('; ')}`);
	}

	/**
	 * Make a request to a specific LLM provider based on config
	 */
	private async makeLLMRequest(config: LLMConfig, options: LLMRequestOptions): Promise<LLMResponse> {
		const configData = JSON.parse(config.config);
		
		switch (config.provider.toLowerCase()) {
			case 'ollama':
				return this.callOllama(configData, options);
			case 'openai':
				return this.callOpenAI(configData, options);
			case 'anthropic':
				return this.callAnthropic(configData, options);
			default:
				throw new Error(`Unsupported LLM provider: ${config.provider}`);
		}
	}

	/**
	 * Call Ollama API
	 */
	private async callOllama(configData: any, options: LLMRequestOptions): Promise<LLMResponse> {
		const baseUrl = configData.base_url || 'http://localhost:11434';
		const model = configData.model || 'llama2';
		
		try {
			const response = await axios.post(`${baseUrl}/api/generate`, {
				model,
				prompt: options.prompt,
				stream: false,
				options: {
					temperature: options.temperature || 0.7,
					num_predict: options.max_tokens || 1000,
					stop: options.stop || []
				}
			});

			return {
				text: response.data.response,
				provider: 'ollama',
				model,
				config_id: configData.id || 0
			};
		} catch (error: any) {
			console.error('Ollama request failed:', error.message);
			throw new Error(`Ollama request failed: ${error.message}`);
		}
	}

	/**
	 * Call OpenAI API
	 */
	private async callOpenAI(configData: any, options: LLMRequestOptions): Promise<LLMResponse> {
		const apiKey = configData.api_key;
		if (!apiKey) {
			throw new Error('OpenAI API key is required');
		}

		const model = configData.model || 'gpt-4o';
		const baseUrl = configData.base_url || 'https://api.openai.com/v1';

		try {
			const response = await axios.post(
				`${baseUrl}/chat/completions`,
				{
					model,
					messages: [{ role: 'user', content: options.prompt }],
					max_tokens: options.max_tokens,
					temperature: options.temperature,
					stop: options.stop
				},
				{
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${apiKey}`
					}
				}
			);

			return {
				text: response.data.choices[0].message.content,
				provider: 'openai',
				model,
				config_id: configData.id || 0
			};
		} catch (error: any) {
			console.error('OpenAI request failed:', error.message);
			throw new Error(`OpenAI request failed: ${error.message}`);
		}
	}

	/**
	 * Call Anthropic API
	 */
	private async callAnthropic(configData: any, options: LLMRequestOptions): Promise<LLMResponse> {
		const apiKey = configData.api_key;
		if (!apiKey) {
			throw new Error('Anthropic API key is required');
		}

		const model = configData.model || 'claude-3-5-sonnet-20240620';
		const baseUrl = configData.base_url || 'https://api.anthropic.com/v1';

		try {
			const response = await axios.post(
				`${baseUrl}/messages`,
				{
					model,
					messages: [{ role: 'user', content: options.prompt }],
					max_tokens: options.max_tokens || 1000,
					temperature: options.temperature || 0.7,
					stop_sequences: options.stop || []
				},
				{
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01'
					}
				}
			);

			return {
				text: response.data.content[0].text,
				provider: 'anthropic',
				model,
				config_id: configData.id || 0
			};
		} catch (error: any) {
			console.error('Anthropic request failed:', error.message);
			throw new Error(`Anthropic request failed: ${error.message}`);
		}
	}
}

// Export a singleton instance
export const llmConfigService = new LLMConfigService();
