import { JobStatus } from '../types';

describe('types', () => {
	it('exposes job status enum values', () => {
		expect(JobStatus.PENDING).toBe('pending');
		expect(JobStatus.RUNNING).toBe('running');
		expect(JobStatus.COMPLETED).toBe('completed');
		expect(JobStatus.FAILED).toBe('failed');
		expect(JobStatus.TIMEOUT).toBe('timeout');
	});
});
