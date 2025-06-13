'use client';

import React, { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import JobsManager from '../components/JobsManager';
import ResultViewModal from '../components/ResultViewModal';

export default function JobsPage() {
	const { getResultById } = useAppData();
	const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selectedResult = selectedResultId !== null ? getResultById(selectedResultId) ?? null : null;

	const handleResultView = (id: number) => {
		const result = getResultById(id);
		if (!result) {
			setError('Result not found');
			setModalOpen(true);
		} else {
			setError(null);
			setSelectedResultId(id);
			setModalOpen(true);
		}
	};

	return (
		<>
			<JobsManager onResultView={handleResultView} />
			<ResultViewModal
				isOpen={modalOpen}
				result={selectedResult}
				error={error}
				onClose={() => setModalOpen(false)}
			/>
		</>
	);
}
