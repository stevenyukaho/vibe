import type { Test } from './types';
import { API_URL, fetchJson } from './fetchJson';

export const testsApi = {
	async getTests(): Promise<Test[]> {
		return fetchJson<Test[]>(`${API_URL}/api/tests`, undefined, 'Failed to fetch tests');
	},

	async createTest(test: Omit<Test, 'id' | 'created_at' | 'updated_at'>): Promise<Test> {
		return fetchJson<Test>(
			`${API_URL}/api/tests`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(test)
			},
			'Failed to create test'
		);
	},

	async getTestById(id: number): Promise<Test> {
		return fetchJson<Test>(`${API_URL}/api/tests/${id}`, undefined, 'Failed to fetch test');
	},

	async updateTest(id: number, test: Partial<Test>): Promise<Test> {
		return fetchJson<Test>(
			`${API_URL}/api/tests/${id}`,
			{
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(test)
			},
			'Failed to update test'
		);
	},

	async deleteTest(id: number): Promise<void> {
		await fetchJson<void>(`${API_URL}/api/tests/${id}`, { method: 'DELETE' }, 'Failed to delete test');
	}
};
