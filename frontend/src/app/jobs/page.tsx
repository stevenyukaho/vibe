'use client';

import React, { useState } from 'react';
import { useResultOperations } from '@/lib/AppDataContext';
import JobsManager from '../components/JobsManager';
import ResultViewModal from '../components/ResultViewModal';
import { TestResult } from '@/lib/api';

export default function JobsPage() {
	const { getResultById } = useResultOperations();
	const [modalOpen, setModalOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

	const handleViewResult = async (id: number) => {
		try {
			setError(null);
			const result = await getResultById(id);
			setSelectedResult(result);
			setModalOpen(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch result');
		}
	};

	return (
		<>
			<JobsManager onResultView={handleViewResult} />
			<ResultViewModal
				isOpen={modalOpen}
				result={selectedResult}
				error={error}
				onClose={() => setModalOpen(false)}
			/>
		</>
	);
}
