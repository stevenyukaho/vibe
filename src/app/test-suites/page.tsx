'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, TestSuite } from '../../lib/api';
import {
	Button,
	Modal,
	TextInput,
	TextArea,
	Form,
	Stack,
	ClickableTile,
	Tag,
	Pagination,
	Grid,
	Column,
	Breadcrumb,
	BreadcrumbItem,
	DataTableSkeleton,
	InlineNotification
} from '@carbon/react';
import { Add, Folder, Calendar, Tag as TagIcon } from '@carbon/icons-react';
import EmptyState from '../components/EmptyState';
import styles from './TestSuites.module.scss';

export default function TestSuitesPage() {
	const router = useRouter();
	const [suites, setSuites] = useState<TestSuite[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState({ name: '', description: '', tags: '' });
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	// Pagination state
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	useEffect(() => {
		async function fetchSuites() {
			try {
				const data = await api.getTestSuites();
				setSuites(data);
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError(err.message);
				} else {
					setError(String(err));
				}
			} finally {
				setLoading(false);
			}
		}
		fetchSuites();
	}, []);

	// Open the modal to add a new suite
	const openModal = () => {
		setFormData({ name: '', description: '', tags: '' });
		setFormError(null);
		setIsModalOpen(true);
	};

	// Submit handler for the modal form
	const handleSubmit = async () => {
		if (!formData.name.trim()) {
			setFormError('Name is required');
			return;
		}
		setIsSaving(true);
		try {
			await api.createTestSuite({
				name: formData.name,
				description: formData.description,
				tags: formData.tags
			});
			const data = await api.getTestSuites();
			setSuites(data);
			setIsModalOpen(false);
		} catch (err: unknown) {
			setFormError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsSaving(false);
		}
	};

	// Handle navigation to test suite details
	const handleSuiteClick = (id: number) => {
		router.push(`/test-suites/${id}`);
	};

	// Format date for display
	const formatDate = (dateString?: string) => {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	// Parse tags from tag string
	const getTags = (tagString?: string) => {
		if (!tagString) {
			return [];
		}
		return tagString.split(',').map(tag => tag.trim()).filter(Boolean);
	};

	// Get current page of data for pagination
	const paginatedSuites = suites.slice(
		(page - 1) * pageSize,
		page * pageSize
	);

	if (loading) {
		return (
			<DataTableSkeleton
				headers={[
					{ header: 'Name' },
					{ header: 'Description' },
					{ header: 'Created' },
					{ header: 'Tags' }
				]}
				rowCount={5}
			/>
		);
	}

	return (
		<div className={styles.container}>
			<Breadcrumb noTrailingSlash>
				<BreadcrumbItem href="/">Home</BreadcrumbItem>
				<BreadcrumbItem isCurrentPage>Test suites</BreadcrumbItem>
			</Breadcrumb>

			<div className={styles.header}>
				<h1>Test Suites</h1>
				<Button renderIcon={Add} onClick={openModal}>
					Add Suite
				</Button>
			</div>

			{error && (
				<InlineNotification
					kind="error"
					title="Error"
					subtitle={error}
					hideCloseButton
					className={styles.notification}
				/>
			)}

			{suites.length > 0 ? (
				<>
					<Grid className={styles.tilesGrid}>
						{paginatedSuites.map((suite) => (
							<Column sm={4} md={4} lg={4} key={suite.id}>
								<ClickableTile
									className={styles.suiteTile}
									onClick={() => handleSuiteClick(suite.id as number)}
								>
									<div className={styles.tileContent}>
										<h4><Folder size={20} /> {suite.name}</h4>
										{suite.description && (
											<p className={styles.description}>{suite.description}</p>
										)}
										<div className={styles.tileFooter}>
											<div className={styles.tileDate}>
												<Calendar size={16} />
												<span>{formatDate(suite.created_at)}</span>
											</div>
											<div className={styles.tileTestCount}>
												<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
													<TagIcon size={16} />
													<span>{typeof suite.test_count === 'number' ? `${suite.test_count} test${suite.test_count === 1 ? '' : 's'}` : '-'}</span>
												</span>
											</div>
											{getTags(suite.tags).length > 0 && (
												<div className={styles.tagContainer}>
													<TagIcon size={16} />
													{getTags(suite.tags).map((tag, index) => (
														<Tag key={index} type="blue" size="sm">{tag}</Tag>
													))}
												</div>
											)}
										</div>
									</div>
								</ClickableTile>
							</Column>
						))}
					</Grid>

					{suites.length > pageSize && (
						<Pagination
							className={styles.pagination}
							page={page}
							pageSize={pageSize}
							pageSizes={[5, 10, 20, 30, 40, 50]}
							totalItems={suites.length}
							onChange={({ page, pageSize }) => {
								setPage(page);
								setPageSize(pageSize);
							}}
						/>
					)}
				</>
			) : (
				<EmptyState
					title="Test Suites"
					description="Create your first test suite to group tests together."
					icon={Folder}
					onAddClick={openModal}
				/>
			)}

			{/* Modal for adding a new suite */}
			<Modal
				open={isModalOpen}
				modalHeading="Add New Test Suite"
				primaryButtonText={isSaving ? 'Saving...' : 'Save'}
				secondaryButtonText="Cancel"
				onRequestClose={() => setIsModalOpen(false)}
				onRequestSubmit={handleSubmit}
				primaryButtonDisabled={isSaving}
			>
				{formError && <InlineNotification kind="error" title="Error" subtitle={formError} hideCloseButton />}
				<Form>
					<Stack gap={7}>
						<TextInput
							id="suite-name"
							labelText="Suite Name"
							value={formData.name}
							onChange={(e) => setFormData(fd => ({ ...fd, name: e.target.value }))}
							placeholder="Enter a name for your test suite"
						/>
						<TextArea
							id="suite-description"
							labelText="Description"
							value={formData.description}
							onChange={(e) => setFormData(fd => ({ ...fd, description: e.target.value }))}
							placeholder="Provide a brief description of this test suite"
							rows={3}
						/>
						<TextInput
							id="suite-tags"
							labelText="Tags"
							value={formData.tags}
							onChange={(e) => setFormData(fd => ({ ...fd, tags: e.target.value }))}
							placeholder="Enter comma-separated tags (e.g., api, benchmark, regression)"
							helperText="Separate tags with commas"
						/>
						{formData.tags && (
							<div className={styles.previewTags}>
								{getTags(formData.tags).map((tag, index) => (
									<Tag key={index} type="blue" size="sm">{tag}</Tag>
								))}
							</div>
						)}
					</Stack>
				</Form>
			</Modal>
		</div>
	);
}
