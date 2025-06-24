import {
	Modal,
	Stack,
	CodeSnippet,
	Tag,
	Button,
	InlineNotification,
} from '@carbon/react';
import { Restart } from '@carbon/icons-react';
import { TestResult, api } from '@/lib/api';
import { useState } from 'react';
import SimilarityScoreDisplay from './SimilarityScoreDisplay';
import './ResultViewModal.scss';

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
	const [rescoring, setRescoring] = useState(false);
	const [rescoreError, setRescoreError] = useState<string | null>(null);
	const [rescoreSuccess, setRescoreSuccess] = useState(false);

	const handleRescore = async () => {
		if (!result?.id) return;
		
		setRescoring(true);
		setRescoreError(null);
		setRescoreSuccess(false);
		
		try {
			await api.scoreResult(result.id);
			setRescoreSuccess(true);

			setTimeout(() => setRescoreSuccess(false), 3000);
		} catch (err) {
			setRescoreError(err instanceof Error ? err.message : 'Failed to initiate scoring');
		} finally {
			setRescoring(false);
		}
	};

	const canScore = result && result.similarity_scoring_status !== undefined;

	return (
		<Modal
			open={isOpen}
			modalHeading="Test Result Details"
			primaryButtonText="Close"
			onRequestClose={onClose}
			onRequestSubmit={onClose}
			size="lg"
			className="result-view-modal"
		>
			<Stack gap={5}>
				{error && (
					<div className="error-message">
						{error}
					</div>
				)}
				
				{rescoreSuccess && (
					<InlineNotification
						kind="success"
						title="Scoring initiated"
						subtitle="The similarity score will be updated shortly."
						hideCloseButton
					/>
				)}
				
				{rescoreError && (
					<InlineNotification
						kind="error"
						title="Failed to initiate scoring"
						subtitle={rescoreError}
						hideCloseButton
					/>
				)}
				
				{result && (
					<>
						<div>
							<h4 className="section-heading">Output</h4>
							<CodeSnippet type="multi" feedback="Copied to clipboard" wrapText>
								{result.output}
							</CodeSnippet>
						</div>
						{result.intermediate_steps && (
							<div>
								<h4 className="section-heading section-heading--with-top-margin">
									Intermediate steps
								</h4>
								<CodeSnippet type="multi" feedback="Copied to clipboard" wrapText maxCollapsedNumberOfRows={20}>
									{result.intermediate_steps}
								</CodeSnippet>
							</div>
						)}
						<div className="metadata-section">
							<div className="metadata-item">
								<strong>Success:</strong>{' '}
								<Tag type={result.success ? 'green' : 'red'}>
									{result.success ? 'Success' : 'Failed'}
								</Tag>
							</div>
							{result.execution_time && (
								<div className="metadata-item">
									<strong>Execution Time:</strong>{' '}
									<span className="execution-time">
										{result.execution_time.toFixed(3)}s
									</span>
								</div>
							)}
							{/* Token usage section */}
							{((result.input_tokens && result.input_tokens > 0) || (result.output_tokens && result.output_tokens > 0)) && (
								<div className="metadata-item">
									<strong>Token usage:</strong>{' '}
									<span className="token-details">
										{result.input_tokens && result.input_tokens > 0 && (
											<>Input: {result.input_tokens.toLocaleString()}</>
										)}
										{result.input_tokens && result.input_tokens > 0 && result.output_tokens && result.output_tokens > 0 && (
											<> | </>
										)}
										{result.output_tokens && result.output_tokens > 0 && (
											<>Output: {result.output_tokens.toLocaleString()}</>
										)}
										{result.input_tokens && result.output_tokens && (
											<> | <strong>Total: {(result.input_tokens + result.output_tokens).toLocaleString()}</strong></>
										)}
									</span>
								</div>
							)}
						</div>
						
						{/* Similarity score section */}
						{canScore && (
							<div className="similarity-score-section">
								<div className="similarity-score-header">
									<h4>Similarity score</h4>
									<Button
										kind="ghost"
										size="sm"
										renderIcon={Restart}
										onClick={handleRescore}
										disabled={rescoring}
									>
										{rescoring ? 'Scoring...' : 'Re-score'}
									</Button>
								</div>
								<SimilarityScoreDisplay result={result} size="md" />
								{result.similarity_scoring_error && (
									<div className="similarity-error">
										<strong>Error:</strong> {result.similarity_scoring_error}
									</div>
								)}
							</div>
						)}
					</>
				)}
			</Stack>
		</Modal>
	);
}
