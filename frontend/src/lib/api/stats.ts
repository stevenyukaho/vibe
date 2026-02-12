import type { StatsResponse } from './types';
import { API_URL, fetchJson } from './fetchJson';

export const statsApi = {
	async getStats(): Promise<StatsResponse> {
		return fetchJson<StatsResponse>(`${API_URL}/api/stats`, undefined, 'Failed to fetch stats');
	}
};
