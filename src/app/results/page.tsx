'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppData } from '@/lib/AppDataContext';
import Results from '../components/Results';
import ResultViewModal from '../components/ResultViewModal';

export default function ResultsPage() {
	const router = useRouter();
	const { getResultById } = useAppData();
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selectedResult = selectedId !== null ? getResultById(selectedId) ?? null : null;

	const handleViewResult = (id: number) => {
		const result = getResultById(id);
		if (!result) return;
		setSelectedId(id);
		setError(null);
		setModalOpen(true);
	};

	const handleAddTestClick = () => {
		router.push('/run');
	};

	return (
		<>
			<Results onViewResult={handleViewResult} onAddTestClick={handleAddTestClick} />
			<ResultViewModal
				isOpen={modalOpen}
				result={selectedResult}
				error={error}
				onClose={() => setModalOpen(false)}
			/>
		</>
	);
}
