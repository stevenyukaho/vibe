import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '@carbon/icons-react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
	it('renders title and triggers click handler', () => {
		const onAddClick = jest.fn();

		render(
			<EmptyState
				title="Agent configurations"
				description="Create your first agent."
				icon={DataTable}
				onAddClick={onAddClick}
			/>
		);

		expect(screen.getByRole('heading', { level: 3, name: /agent configurations/i })).toBeInTheDocument();
		const button = screen.getByRole('button', { name: /add agent/i });
		fireEvent.click(button);
		expect(onAddClick).toHaveBeenCalledTimes(1);
	});
});
