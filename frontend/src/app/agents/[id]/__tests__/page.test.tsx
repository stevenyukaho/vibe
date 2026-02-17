import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentDetailPage from '../page';
import { api } from '../../../../lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
	useParams: () => ({ id: '42' }),
	useRouter: () => ({ push: mockPush })
}));

jest.mock('../../../../lib/api', () => ({
	api: {
		getAgentById: jest.fn(),
		getExecutionSessions: jest.fn(),
		getAgentRequestTemplates: jest.fn(),
		getAgentResponseMaps: jest.fn(),
		deleteAgent: jest.fn(),
		linkAgentRequestTemplate: jest.fn(),
		updateAgentRequestTemplateLink: jest.fn(),
		unlinkAgentRequestTemplate: jest.fn(),
		setDefaultAgentRequestTemplate: jest.fn(),
		createAgentRequestTemplate: jest.fn(),
		linkAgentResponseMap: jest.fn(),
		updateAgentResponseMapLink: jest.fn(),
		unlinkAgentResponseMap: jest.fn(),
		setDefaultAgentResponseMap: jest.fn(),
		createAgentResponseMap: jest.fn(),
		updateAgent: jest.fn()
	}
}));

jest.mock('../../../components/SessionsTable', () => ({
	__esModule: true,
	default: () => <div>SessionsTable</div>
}));

jest.mock('../../../components/AgentAnalytics', () => ({
	__esModule: true,
	default: () => <div>AgentAnalytics</div>
}));

jest.mock('../../../components/AgentFormModal', () => ({
	__esModule: true,
	default: () => <div>AgentFormModal</div>
}));

jest.mock('../../../components/DeleteConfirmationModal', () => ({
	__esModule: true,
	default: () => <div>DeleteConfirmationModal</div>
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
	jest.clearAllMocks();
	mockPush.mockReset();
});

describe('AgentDetailPage', () => {
	it('shows load errors and allows navigating back to list', async () => {
		const user = userEvent.setup();
		mockedApi.getAgentById.mockRejectedValue(new Error('Unable to load agent'));

		render(<AgentDetailPage />);

		expect(await screen.findByText('Unable to load agent')).toBeInTheDocument();
		expect(mockedApi.getExecutionSessions).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: 'Back to agents' }));
		expect(mockPush).toHaveBeenCalledWith('/agents');
	});
});
