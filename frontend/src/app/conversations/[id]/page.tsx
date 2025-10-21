'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, InlineLoading, InlineNotification, Tile, Tag, Modal, ComboBox } from '@carbon/react';
import { api, Conversation, ExecutionSession, SessionMessage, Agent } from '../../../lib/api';
import SessionViewer from '../../components/SessionViewer';
import styles from './page.module.scss';

export default function ConversationDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const [conversation, setConversation] = useState<Conversation | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [session, setSession] = useState<ExecutionSession | null>(null);
	const [messages, setMessages] = useState<SessionMessage[]>([]);
	const [executing, setExecuting] = useState(false);
	const [agents, setAgents] = useState<Agent[]>([]);
	const [execModalOpen, setExecModalOpen] = useState(false);
	const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

	const load = async () => {
		try {
			setLoading(true);
			const id = Number(params.id);
			const c = await api.getConversationById(id);
			setConversation(c);

			const sessionsResp = await api.getExecutionSessions({ conversation_id: id, limit: 1, offset: 0 });
			const s = (Array.isArray(sessionsResp) ? sessionsResp : sessionsResp.data)?.[0];
			if (s) {
				// Get both session and messages in one call
				const transcriptData = await api.getSessionTranscriptWithSession(s.id!);
				setSession(transcriptData.session);
				setMessages(transcriptData.messages || []);
			} else {
				setSession(null);
				setMessages([]);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'failed to load conversation');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		api.getAgents().then(setAgents).catch(() => { });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params.id]);

	const handleExecuteWithAgent = async (agentId: number) => {
		if (!conversation?.id) return;
		try {
			setExecuting(true);
			await api.executeConversation(agentId, conversation.id);
			// refresh after a short delay or navigate to jobs
			setTimeout(load, 1000);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'failed to execute conversation');
		} finally {
			setExecuting(false);
		}
	};

	const handleEditSuccess = () => {
		setEditModalOpen(false);
		load();
	};

	const handleDuplicate = async () => {
		if (!conversation) {
			return;
		}

		setDuplicating(true);
		setError(null);

		try {
			// Create a copy of the conversation with a new name
			const duplicatedConversation = {
				...conversation,
				name: `${conversation.name} (Copy)`,
				id: undefined // Remove ID to create new conversation
			};

			const newConversation = await api.createConversation(duplicatedConversation);
			router.push(`/conversations/${newConversation.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to duplicate conversation');
		} finally {
			setDuplicating(false);
		}
	};

	const handleDelete = async () => {
		if (!conversation?.id) return;

		setDeleting(true);
		setError(null);

		try {
			await api.deleteConversation(conversation.id);
			router.push('/conversations'); // Navigate back to conversations list
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete conversation');
		} finally {
			setDeleting(false);
			setDeleteModalOpen(false);
		}
	};

	if (loading) {
		return <InlineLoading description="loading conversation" />;
	}
	if (error) {
		return <InlineNotification kind="error" title="Error" subtitle={error} hideCloseButton />;
	}
	if (!conversation) {
		return <InlineNotification kind="error" title="Not found" subtitle="conversation not found" hideCloseButton />;
	}

	return (
		<div className={styles.container}>
			<div className={styles.headerRow}>
				<div>
					<h2 className={styles.title}>{conversation.name}</h2>
					<div className={styles.tagRow}>
						{conversation.tags ? JSON.parse(conversation.tags).map((t: string, i: number) => (
							<Tag key={i} type="blue" size="sm">{t}</Tag>
						)) : null}
					</div>
				</div>
				<div className={styles.actions}>
					<Button kind="tertiary" onClick={() => router.push('/conversations')}>back</Button>
					<Button kind="primary" disabled={executing} onClick={() => setExecModalOpen(true)}>execute</Button>
				</div>
			</div>

			<Tile>
				<h4 className={styles.sectionTitle}>script</h4>
				{conversation.messages && conversation.messages.length > 0 ? (
					<ul>
						{conversation.messages.map((m) => (
							<li key={m.sequence}><strong>{m.role}:</strong> {m.content}</li>
						))}
					</ul>
				) : (
					<span>no messages defined</span>
				)}
			</Tile>

			<Tile>
				<h4 className={styles.sectionTitle}>latest session</h4>
				{session ? (
					<SessionViewer session={session} messages={messages} />
				) : (
					<span>no session yet</span>
				)}
			</Tile>

			<Modal
				open={execModalOpen}
				modalHeading="execute conversation"
				primaryButtonText={executing ? 'executing...' : 'run'}
				primaryButtonDisabled={executing || !selectedAgent}
				secondaryButtonText="cancel"
				onRequestClose={() => setExecModalOpen(false)}
				onRequestSubmit={async () => {
					if (!selectedAgent || !conversation) return;
					await handleExecuteWithAgent(selectedAgent.id!);
					setExecModalOpen(false);
				}}
			>
				<div className={styles.modalField}>
					<ComboBox
						id="agent-selector"
						titleText="select agent"
						items={agents}
						itemToString={(item) => (item ? `${item.name} (v${item.version})` : '')}
						selectedItem={selectedAgent}
						onChange={({ selectedItem }) => setSelectedAgent(selectedItem as Agent)}
						placeholder="choose an agent"
					/>
				</div>
			</Modal>
		</div>
	);
}


