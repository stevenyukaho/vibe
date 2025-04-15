import { useState } from 'react';
import { Modal } from '@carbon/react';
import { api } from '@/lib/api';

interface DeleteConfirmationModalProps {
	isOpen: boolean;
	deleteType: 'agent' | 'test' | null;
	deleteName: string;
	deleteId: number | null;
	onClose: () => void;
	onSuccess: () => void;
}

export default function DeleteConfirmationModal({
	isOpen,
	deleteType,
	deleteName,
	deleteId,
	onClose,
	onSuccess
}: DeleteConfirmationModalProps) {
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDelete = async () => {
		if (!deleteId || !deleteType) return;

		setDeleting(true);
		setError(null);

		try {
			if (deleteType === 'agent') {
				await api.deleteAgent(deleteId);
			} else if (deleteType === 'test') {
				await api.deleteTest(deleteId);
			}

			onSuccess();
			onClose();
		} catch (error) {
			console.error(`Error deleting ${deleteType}:`, error);
			setError(error instanceof Error ? error.message : `Failed to delete ${deleteType}`);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<Modal
			open={isOpen}
			modalHeading={`Delete ${deleteType === 'agent' ? 'Agent' : 'Test'}`}
			primaryButtonText={deleting ? 'Deleting...' : 'Delete'}
			secondaryButtonText="Cancel"
			onRequestClose={onClose}
			onRequestSubmit={handleDelete}
			primaryButtonDisabled={deleting}
			danger
		>
			{error && (
				<div style={{
					marginBottom: '1rem',
					padding: '0.5rem',
					backgroundColor: '#fff1f1',
					color: '#da1e28',
					borderLeft: '3px solid #da1e28'
				}}>
					{error}
				</div>
			)}
			<p>Are you sure you want to delete the {deleteType === 'agent' ? 'agent' : 'test'} &quot;{deleteName}&quot;?</p>
		</Modal>
	);
}
