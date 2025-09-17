'use client';

import React, { useMemo } from 'react';
import { Tag, Tile, CodeSnippet } from '@carbon/react';
import { ExpandableText } from './ExpandableText';
import type { ExecutionSession, SessionMessage } from '../../lib/api';
import styles from './SessionViewer.module.scss';

interface SessionViewerProps {
	session: ExecutionSession;
	messages: SessionMessage[];
}

const renderMetadata = (metadata?: string) => {
	try {
		const meta = metadata ? JSON.parse(metadata) : {};
		return (
			<>
				{meta.execution_time_ms !== undefined && (
					<span className={styles.metaChip}>⏱ {meta.execution_time_ms}ms</span>
				)}
				{meta.input_tokens !== undefined && (
					<span className={styles.metaChip}>in: {meta.input_tokens}</span>
				)}
				{meta.output_tokens !== undefined && (
					<span className={styles.metaChip}>out: {meta.output_tokens}</span>
				)}
			</>
		);
	} catch {
		return null;
	}
};

export default function SessionViewer({ session, messages }: SessionViewerProps) {
	const ordered = useMemo(() => {
		return [...messages].sort((a, b) => a.sequence - b.sequence);
	}, [messages]);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.meta}>
					<Tag type={session.status === 'completed' ? 'green' : session.status === 'running' ? 'blue' : session.status === 'failed' ? 'red' : 'cool-gray'}>
						{session.status}
					</Tag>
					{typeof session.success === 'boolean' && (
						<Tag type={session.success ? 'green' : 'red'}>{session.success ? 'success' : 'failure'}</Tag>
					)}
					{session.started_at && session.completed_at && (
						<Tag type="purple">
							{Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)}s
						</Tag>
					)}
				</div>
			</div>

			<div className={styles.transcript}>
				{ordered.length === 0 && (
					<Tile className={styles.empty}>No transcript available for this session.</Tile>
				)}
				{ordered.map((m) => (
					<div key={m.sequence} className={`${styles.message} ${styles[m.role] || ''}`}>
						<div className={styles.role}>{m.role}</div>
						<div className={styles.bubble}>
							<div className={styles.content}>
								{m.content.startsWith('```') ? (
									<CodeSnippet type="multi" wrapText>
										{m.content.replace(/^```[a-zA-Z]*\n?|```$/g, '')}
									</CodeSnippet>
								) : (
									<ExpandableText text={m.content} />
								)}
							</div>
							<div className={styles.metaRow}>
								<span className={styles.timestamp}>{new Date(m.timestamp).toLocaleString()}</span>
								{renderMetadata(m.metadata)}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
