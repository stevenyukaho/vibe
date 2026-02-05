import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LLMConfigFormModal from '../LLMConfigFormModal';
import { useLLMConfigs } from '../../../lib/AppDataContext';

jest.mock('../../../lib/AppDataContext', () => ({
	useLLMConfigs: jest.fn()
}));

const mockedUseLLMConfigs = useLLMConfigs as jest.Mock;

beforeAll(() => {
	class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	(window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = ResizeObserver;
});

beforeEach(() => {
	jest.clearAllMocks();
	mockedUseLLMConfigs.mockReturnValue({
		createLLMConfig: jest.fn().mockResolvedValue({ id: 1 }),
		updateLLMConfig: jest.fn().mockResolvedValue({ id: 1 })
	});
});

describe('LLMConfigFormModal', () => {
	it('shows error when JSON configuration is invalid', async () => {
		const user = userEvent.setup();
		render(<LLMConfigFormModal isOpen onClose={jest.fn()} />);

		const configInput = screen.getByLabelText('Configuration (JSON)');
		fireEvent.change(configInput, { target: { value: '{invalid' } });
		await user.click(screen.getByRole('button', { name: 'Create' }));

		expect(await screen.findByText('Invalid JSON configuration')).toBeInTheDocument();
	});

	it('creates a new LLM config with valid input', async () => {
		const user = userEvent.setup();
		const onClose = jest.fn();

		render(<LLMConfigFormModal isOpen onClose={onClose} />);
		const { createLLMConfig } = mockedUseLLMConfigs.mock.results[0].value;

		await user.type(screen.getByLabelText('Name'), 'Default config');
		await user.click(screen.getByRole('button', { name: 'Create' }));

		await waitFor(() => {
			expect(createLLMConfig).toHaveBeenCalled();
		});
		expect(onClose).toHaveBeenCalled();
	});
});
