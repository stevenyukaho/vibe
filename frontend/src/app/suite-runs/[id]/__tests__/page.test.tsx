import { render, screen } from '@testing-library/react';
import SuiteRunDetailPage from '../page';
import { api } from '../../../../lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
	useParams: () => ({ id: 'not-a-number' }),
	useRouter: () => ({ push: mockPush })
}));

jest.mock('../../../../lib/api', () => ({
	api: {
		getSuiteRun: jest.fn(),
		getSuiteRunJobs: jest.fn(),
		getConversationById: jest.fn()
	}
}));

jest.mock('@/lib/AppDataContext', () => ({
	useAppData: () => ({
		getTestById: jest.fn(),
		getResultById: jest.fn(),
		getAgentById: jest.fn(),
		fetchAllData: jest.fn()
	}),
	useResultOperations: () => ({
		getResultById: jest.fn()
	})
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
	jest.clearAllMocks();
	mockPush.mockReset();
});

describe('SuiteRunDetailPage', () => {
	it('shows validation error for invalid suite run IDs', async () => {
		render(<SuiteRunDetailPage />);

		expect(await screen.findByText('Invalid suite run ID')).toBeInTheDocument();
		expect(mockedApi.getSuiteRun).not.toHaveBeenCalled();
		expect(mockedApi.getSuiteRunJobs).not.toHaveBeenCalled();
	});
});
