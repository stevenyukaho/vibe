import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppDataProvider, useAppData } from '../AppDataContext';
import { api } from '../api';

jest.mock('../api', () => ({
	api: {
		getAgents: jest.fn(),
		createAgent: jest.fn(),
		getTests: jest.fn(),
		getLLMConfigs: jest.fn(),
		getResults: jest.fn()
	}
}));

const mockedApi = api as jest.Mocked<typeof api>;

const Harness = () => {
	const { agents, fetchAgents, createAgent, getAgentById } = useAppData();

	return (
		<div>
			<div data-testid="agent-count">{agents.length}</div>
			<div data-testid="agent-name">{getAgentById(1)?.name || ''}</div>
			<button type="button" onClick={() => fetchAgents()}>
				Fetch
			</button>
			<button
				type="button"
				onClick={() => createAgent({ name: 'New', version: '1', prompt: 'p', settings: '{}' } as any)}
			>
				Create
			</button>
		</div>
	);
};

describe('AppDataContext', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedApi.getAgents.mockResolvedValue([{ id: 1, name: 'Agent A' }] as any);
		mockedApi.createAgent.mockResolvedValue({ id: 2, name: 'Agent B' } as any);
	});

	it('throws when used outside provider', () => {
		const Broken = () => {
			useAppData();
			return null;
		};

		expect(() => render(<Broken />)).toThrow('useAppData must be used within an AppDataProvider');
		allowConsoleErrors();
	});

	it('fetches and creates agents', async () => {
		const user = userEvent.setup();

		render(
			<AppDataProvider>
				<Harness />
			</AppDataProvider>
		);

		await user.click(screen.getByRole('button', { name: 'Fetch' }));

		await waitFor(() => {
			expect(screen.getByTestId('agent-count').textContent).toBe('1');
		});

		await user.click(screen.getByRole('button', { name: 'Create' }));

		await waitFor(() => {
			expect(screen.getByTestId('agent-count').textContent).toBe('2');
		});
	});
});
