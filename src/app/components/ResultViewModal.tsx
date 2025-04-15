import {
	Modal,
	Stack,
	CodeSnippet,
	Tag,
} from '@carbon/react';
import { TestResult } from '@/lib/api';

interface ResultViewModalProps {
	isOpen: boolean;
	result: TestResult | null;
	error: string | null;
	onClose: () => void;
}

export default function ResultViewModal({
	isOpen,
	result,
	error,
	onClose
}: ResultViewModalProps) {
	return (
		<Modal
			open={isOpen}
			modalHeading="Test Result Details"
			primaryButtonText="Close"
			onRequestClose={onClose}
			onRequestSubmit={onClose}
		>
			<Stack gap={5}>
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
				{result && (
					<>
						<div>
							<h4 style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>Output</h4>
							<CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
								{result.output}
							</CodeSnippet>
						</div>
						{result.intermediate_steps && (
							<div>
								<h4 style={{ color: '#f4f4f4', marginBottom: '0.5rem', marginTop: '1rem' }}>
									Intermediate Steps
								</h4>
								<CodeSnippet type="multi" feedback="Copied to clipboard" wrapText maxCollapsedNumberOfRows={20}>
									{result.intermediate_steps}
								</CodeSnippet>
							</div>
						)}
						<div style={{
							display: 'flex',
							gap: '1rem',
							alignItems: 'center',
							marginTop: '1rem',
							padding: '1rem',
							backgroundColor: '#161616',
							borderRadius: '4px'
						}}>
							<div>
								<strong style={{ color: '#f4f4f4' }}>Success:</strong>{' '}
								<Tag type={result.success ? 'green' : 'red'}>
									{result.success ? 'Success' : 'Failed'}
								</Tag>
							</div>
							{result.execution_time && (
								<div>
									<strong style={{ color: '#f4f4f4' }}>Execution Time:</strong>{' '}
									<span style={{ color: '#f4f4f4' }}>
										{result.execution_time.toFixed(3)}s
									</span>
								</div>
							)}
						</div>
					</>
				)}
			</Stack>
		</Modal>
	);
}
