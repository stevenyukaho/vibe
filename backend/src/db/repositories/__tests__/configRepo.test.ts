import { LLMConfig } from '@ibm-vibe/types';
import * as configRepo from '../configRepo';

// Mock the database module
jest.mock('../../database', () => {
	const mockPrepare = jest.fn();
	return {
		__esModule: true,
		default: {
			prepare: mockPrepare
		}
	};
});

import db from '../../database';

const mockDb = db as jest.Mocked<typeof db>;

describe('configRepo', () => {
	let mockGet: jest.Mock;
	let mockAll: jest.Mock;
	let mockRun: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		mockGet = jest.fn();
		mockAll = jest.fn();
		mockRun = jest.fn();

		// Default mock for prepare
		(mockDb.prepare as any).mockReturnValue({
			get: mockGet,
			all: mockAll,
			run: mockRun
		});
	});

	describe('createLLMConfig', () => {
		it('creates LLM config with all fields', () => {
			const config: LLMConfig = {
				name: 'GPT-4',
				provider: 'openai',
				config: '{"model":"gpt-4","temperature":0.7}',
				priority: 10
			} as LLMConfig;

			const created = { id: 1, ...config, created_at: '2024-01-01', updated_at: '2024-01-01' } as LLMConfig;
			mockGet.mockReturnValue(created);

			const result = configRepo.createLLMConfig(config);

			expect(result).toEqual(created);
			expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO llm_configs'));
			expect(mockGet).toHaveBeenCalledWith(config);
		});

		it('creates LLM config with default values for missing fields', () => {
			const config = { name: 'Test' } as LLMConfig;
			const expected = {
				name: 'Test',
				provider: '',
				config: '{}',
				priority: 100
			};

			mockGet.mockReturnValue({ id: 1, ...expected });

			configRepo.createLLMConfig(config);

			expect(mockGet).toHaveBeenCalledWith(expected);
		});

		it('uses default priority of 100 when not provided', () => {
			const config = {
				name: 'Test',
				provider: 'openai',
				config: '{}'
			} as LLMConfig;

			mockGet.mockReturnValue({ id: 1, ...config, priority: 100 });

			configRepo.createLLMConfig(config);

			expect(mockGet).toHaveBeenCalledWith(expect.objectContaining({ priority: 100 }));
		});
	});

	describe('getLLMConfigs', () => {
		it('returns all LLM configs ordered by priority ASC', () => {
			const configs = [
				{ id: 1, name: 'High Priority', priority: 1 },
				{ id: 2, name: 'Low Priority', priority: 100 }
			] as LLMConfig[];

			mockAll.mockReturnValue(configs);

			const result = configRepo.getLLMConfigs();

			expect(result).toEqual(configs);
			expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM llm_configs ORDER BY priority ASC');
		});

		it('returns empty array when no configs exist', () => {
			mockAll.mockReturnValue([]);

			const result = configRepo.getLLMConfigs();

			expect(result).toEqual([]);
		});
	});

	describe('getLLMConfigById', () => {
		it('returns LLM config by id', () => {
			const config = { id: 1, name: 'Test', provider: 'openai' } as LLMConfig;
			mockGet.mockReturnValue(config);

			const result = configRepo.getLLMConfigById(1);

			expect(result).toEqual(config);
			expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM llm_configs WHERE id = ?');
			expect(mockGet).toHaveBeenCalledWith(1);
		});

		it('returns undefined when config not found', () => {
			mockGet.mockReturnValue(undefined);

			const result = configRepo.getLLMConfigById(999);

			expect(result).toBeUndefined();
		});
	});

	describe('updateLLMConfig', () => {
		it('updates LLM config with provided fields', () => {
			const updates = { name: 'Updated', priority: 50 };
			const updated = { id: 1, ...updates, provider: 'openai', config: '{}' } as LLMConfig;

			mockGet.mockReturnValue(updated);

			const result = configRepo.updateLLMConfig(1, updates);

			expect(result).toEqual(updated);
			expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE llm_configs'));
			expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('updated_at = CURRENT_TIMESTAMP'));
			expect(mockGet).toHaveBeenCalledWith({ id: 1, ...updates });
		});

		it('returns existing config when no fields to update', () => {
			const existing = { id: 1, name: 'Test' } as LLMConfig;
			mockGet.mockReturnValue(existing);

			const result = configRepo.updateLLMConfig(1, {});

			expect(result).toEqual(existing);
			expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM llm_configs WHERE id = ?');
		});

		it('filters out undefined values', () => {
			const updates = { name: 'Updated', priority: undefined };
			mockGet.mockReturnValue({ id: 1, name: 'Updated' } as LLMConfig);

			configRepo.updateLLMConfig(1, updates);

			expect(mockGet).toHaveBeenCalledWith({ id: 1, name: 'Updated' });
		});

		it('excludes id and created_at from updates', () => {
			const updates = { name: 'Updated', id: 999, created_at: '2024-01-01' } as any;
			mockGet.mockReturnValue({ id: 1, name: 'Updated' } as LLMConfig);

			configRepo.updateLLMConfig(1, updates);

			const updateCall = (mockDb.prepare as any).mock.calls.find((call: any) =>
				call[0].includes('UPDATE llm_configs')
			);
			const setClause = updateCall[0].split('WHERE')[0];
			expect(setClause).toContain('name = @name');
			expect(setClause).not.toContain('created_at =');
		});

		it('updates priority field', () => {
			const updates = { priority: 1 };
			mockGet.mockReturnValue({ id: 1, priority: 1 } as LLMConfig);

			configRepo.updateLLMConfig(1, updates);

			expect(mockGet).toHaveBeenCalledWith({ id: 1, priority: 1 });
		});

		it('updates config field', () => {
			const updates = { config: '{"model":"gpt-4-turbo"}' };
			mockGet.mockReturnValue({ id: 1, config: '{"model":"gpt-4-turbo"}' } as LLMConfig);

			configRepo.updateLLMConfig(1, updates);

			expect(mockGet).toHaveBeenCalledWith({ id: 1, config: '{"model":"gpt-4-turbo"}' });
		});
	});

	describe('deleteLLMConfig', () => {
		it('deletes LLM config by id', () => {
			const runResult = { changes: 1 };
			mockRun.mockReturnValue(runResult);

			const result = configRepo.deleteLLMConfig(1);

			expect(result).toEqual(runResult);
			expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM llm_configs WHERE id = ?');
			expect(mockRun).toHaveBeenCalledWith(1);
		});

		it('returns result even when config does not exist', () => {
			const runResult = { changes: 0 };
			mockRun.mockReturnValue(runResult);

			const result = configRepo.deleteLLMConfig(999);

			expect(result).toEqual(runResult);
		});
	});

	describe('getLLMConfigsWithCount', () => {
		it('returns configs with total count', () => {
			const configs = [{ id: 1, name: 'Test' }] as LLMConfig[];
			mockAll.mockReturnValue(configs);
			mockGet.mockReturnValue({ count: 10 });

			const result = configRepo.getLLMConfigsWithCount();

			expect(result).toEqual({ data: configs, total: 10 });
		});

		it('applies limit and offset', () => {
			mockAll.mockReturnValue([]);
			mockGet.mockReturnValue({ count: 0 });

			configRepo.getLLMConfigsWithCount({ limit: 10, offset: 20 });

			const queryCall = (mockDb.prepare as any).mock.calls[0][0];
			expect(queryCall).toContain('LIMIT ?');
			expect(queryCall).toContain('OFFSET ?');
			expect(mockAll).toHaveBeenCalledWith(10, 20);
		});

		it('works without limit and offset', () => {
			mockAll.mockReturnValue([]);
			mockGet.mockReturnValue({ count: 0 });

			configRepo.getLLMConfigsWithCount({});

			const queryCall = (mockDb.prepare as any).mock.calls[0][0];
			expect(queryCall).not.toContain('LIMIT');
			expect(queryCall).not.toContain('OFFSET');
		});

		it('orders by priority ASC', () => {
			mockAll.mockReturnValue([]);
			mockGet.mockReturnValue({ count: 0 });

			configRepo.getLLMConfigsWithCount();

			const queryCall = (mockDb.prepare as any).mock.calls[0][0];
			expect(queryCall).toContain('ORDER BY priority ASC');
		});

		it('applies only limit when offset not provided', () => {
			mockAll.mockReturnValue([]);
			mockGet.mockReturnValue({ count: 0 });

			configRepo.getLLMConfigsWithCount({ limit: 5 });

			const queryCall = (mockDb.prepare as any).mock.calls[0][0];
			expect(queryCall).toContain('LIMIT ?');
			expect(queryCall).not.toContain('OFFSET');
			expect(mockAll).toHaveBeenCalledWith(5);
		});

		it('applies only offset when limit not provided', () => {
			mockAll.mockReturnValue([]);
			mockGet.mockReturnValue({ count: 0 });

			configRepo.getLLMConfigsWithCount({ offset: 10 });

			const queryCall = (mockDb.prepare as any).mock.calls[0][0];
			expect(queryCall).not.toContain('LIMIT');
			expect(queryCall).toContain('OFFSET ?');
			expect(mockAll).toHaveBeenCalledWith(10);
		});

		it('returns correct total even with pagination', () => {
			const configs = [{ id: 1, name: 'Test' }] as LLMConfig[];
			mockAll.mockReturnValue(configs);
			mockGet.mockReturnValue({ count: 100 });

			const result = configRepo.getLLMConfigsWithCount({ limit: 10, offset: 0 });

			expect(result.data).toHaveLength(1);
			expect(result.total).toBe(100);
		});
	});

	describe('edge cases', () => {
		it('handles empty string values in config', () => {
			const config = {
				name: '',
				provider: '',
				config: '',
				priority: 0
			} as LLMConfig;

			mockGet.mockReturnValue({ id: 1, ...config });

			const result = configRepo.createLLMConfig(config);

			expect(result.name).toBe('');
			expect(result.provider).toBe('');
		});

		it('handles very high priority values', () => {
			const config = {
				name: 'Test',
				provider: 'openai',
				config: '{}',
				priority: 999999
			} as LLMConfig;

			mockGet.mockReturnValue({ id: 1, ...config });

			const result = configRepo.createLLMConfig(config);

			expect(result.priority).toBe(999999);
		});

		it('handles very low priority values', () => {
			const config = {
				name: 'Test',
				provider: 'openai',
				config: '{}',
				priority: -100
			} as LLMConfig;

			mockGet.mockReturnValue({ id: 1, ...config });

			const result = configRepo.createLLMConfig(config);

			expect(result.priority).toBe(-100);
		});

		it('handles complex JSON config', () => {
			const complexConfig = JSON.stringify({
				model: 'gpt-4',
				temperature: 0.7,
				max_tokens: 1000,
				nested: {
					key: 'value',
					array: [1, 2, 3]
				}
			});

			const config = {
				name: 'Complex',
				provider: 'openai',
				config: complexConfig,
				priority: 50
			} as LLMConfig;

			mockGet.mockReturnValue({ id: 1, ...config });

			const result = configRepo.createLLMConfig(config);

			expect(result.config).toBe(complexConfig);
		});

		it('handles update with all fields', () => {
			const updates = {
				name: 'New Name',
				provider: 'new-provider',
				config: '{"new":"config"}',
				priority: 25
			};

			mockGet.mockReturnValue({ id: 1, ...updates } as LLMConfig);

			configRepo.updateLLMConfig(1, updates);

			expect(mockGet).toHaveBeenCalledWith({ id: 1, ...updates });
		});
	});
});

// Made with Bob
