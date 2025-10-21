'use client';

import React, { useState, useEffect } from 'react';
import {
	Modal,
	TextInput,
	TextArea,
	Button,
	ToastNotification,
	Tag,
	Tile,
	Grid,
	Column,
	Select,
	SelectItem,
	IconButton
} from '@carbon/react';
import { Add, TrashCan, ArrowUp, ArrowDown } from '@carbon/icons-react';
import { api, Conversation, ConversationMessage } from '../../lib/api';
import styles from './ConversationFormModal.module.scss';

interface ConversationFormModalProps {
    open: boolean;
    conversation?: Conversation;
    onClose: () => void;
    onSave: (conversation: Conversation) => void;
}

interface TurnTargetMap {
	[userSequence: number]: {
		target_reply: string;
		threshold?: number | null;
		weight?: number | null;
	};
}

export default function ConversationFormModal({
	open,
	conversation,
	onClose,
	onSave
}: ConversationFormModalProps) {
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		expected_outcome: '',
		tags: [] as string[]
	});
	const [messages, setMessages] = useState<ConversationMessage[]>([]);
	const [turnTargets, setTurnTargets] = useState<TurnTargetMap>({});
	const [newTag, setNewTag] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (conversation) {
			setFormData({
				name: conversation.name || '',
				description: conversation.description || '',
				expected_outcome: conversation.expected_outcome || '',
				tags: conversation.tags ? JSON.parse(conversation.tags) : []
			});
			setMessages(conversation.messages || []);

			// Load turn targets
			if (conversation.id) {
				api.getConversationTurnTargets(conversation.id)
					.then(targets => {
						const targetMap: TurnTargetMap = {};
						targets.forEach(t => {
							targetMap[t.user_sequence] = {
								target_reply: t.target_reply,
								threshold: t.threshold,
								weight: t.weight
							};
						});
						setTurnTargets(targetMap);
					})
					.catch(err => console.error('Failed to load turn targets:', err));
			}
		} else {
			setFormData({
				name: '',
				description: '',
				expected_outcome: '',
				tags: []
			});
			setMessages([]);
			setTurnTargets({});
		}
		setError(null);
	}, [conversation, open]);

	const handleSubmit = async () => {
		if (!formData.name.trim()) {
			setError('Name is required');
			return;
		}

		if (messages.length === 0) {
			setError('At least one message is required');
			return;
		}

		try {
			setLoading(true);
			const conversationData = {
				...formData,
				tags: JSON.stringify(formData.tags),
				messages: messages.map((msg, index) => ({
					...msg,
					sequence: index + 1
				}))
			};

			let savedConversation: Conversation;
			if (conversation?.id) {
				savedConversation = await api.updateConversation(conversation.id, conversationData);
			} else {
				savedConversation = await api.createConversation(conversationData);
			}

			// Save turn targets
			if (savedConversation.id) {
				const userMessages = messages
					.map((msg, index) => ({ ...msg, sequence: index + 1 }))
					.filter(msg => msg.role === 'user');

				for (const userMsg of userMessages) {
					const target = turnTargets[userMsg.sequence];
					if (target && target.target_reply && target.target_reply.trim()) {
						await api.saveConversationTurnTarget({
							conversation_id: savedConversation.id,
							user_sequence: userMsg.sequence,
							target_reply: target.target_reply,
							threshold: target.threshold,
							weight: target.weight
						});
					}
				}
			}

			onSave(savedConversation);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save conversation');
		} finally {
			setLoading(false);
		}
	};

	const addTag = () => {
		if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
			setFormData(prev => ({
				...prev,
				tags: [...prev.tags, newTag.trim()]
			}));
			setNewTag('');
		}
	};

	const removeTag = (tagToRemove: string) => {
		setFormData(prev => ({
			...prev,
			tags: prev.tags.filter(tag => tag !== tagToRemove)
		}));
	};

	const addMessage = () => {
		const newMessage: ConversationMessage = {
			sequence: messages.length + 1,
			role: 'user',
			content: ''
		};
		setMessages([...messages, newMessage]);
	};

	const updateMessage = (index: number, updates: Partial<ConversationMessage>) => {
		const updatedMessages = messages.map((msg, i) =>
			i === index ? { ...msg, ...updates } : msg,
		);
		setMessages(updatedMessages);
	};

	const removeMessage = (index: number) => {
		const updatedMessages = messages.filter((_, i) => i !== index);
		setMessages(updatedMessages);
	};

	const moveMessage = (index: number, direction: 'up' | 'down') => {
		if (
			(direction === 'up' && index === 0) ||
            (direction === 'down' && index === messages.length - 1)
		) {
			return;
		}

		const newMessages = [...messages];
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		[newMessages[index], newMessages[targetIndex]] = [newMessages[targetIndex], newMessages[index]];
		setMessages(newMessages);
	};

	return (
		<Modal
			open={open}
			onRequestClose={onClose}
			modalHeading={conversation ? 'Edit conversation' : 'Create conversation'}
			modalLabel="Conversation"
			primaryButtonText={loading ? 'Saving...' : 'Save'}
			secondaryButtonText="Cancel"
			primaryButtonDisabled={loading}
			onRequestSubmit={handleSubmit}
			size="lg"
		>
			<div className={styles.modalContent}>
				{error && (
					<ToastNotification
						kind="error"
						title="Error"
						subtitle={error}
						onCloseButtonClick={() => setError(null)}
					/>
				)}

				<Grid>
					<Column sm={4} md={8} lg={16}>
						<TextInput
							id="name"
							labelText="Name"
							value={formData.name}
							onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
							placeholder="Enter conversation name"
							required
						/>
					</Column>
					<Column sm={4} md={8} lg={16}>
						<TextArea
							id="description"
							labelText="Description"
							value={formData.description}
							onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
							placeholder="Describe what this conversation tests"
							rows={3}
						/>
					</Column>
					<Column sm={4} md={8} lg={16}>
						<TextArea
							id="expected_outcome"
							labelText="Expected outcome"
							value={formData.expected_outcome}
							onChange={(e) => setFormData(prev => ({ ...prev, expected_outcome: e.target.value }))}
							placeholder="Describe the expected results"
							rows={2}
						/>
					</Column>
					<Column sm={4} md={8} lg={16}>
						<div className={styles.tagsSection}>
							<label className={styles.label}>Tags</label>
							<div className={styles.tagInput}>
								<TextInput
									id="new-tag"
									labelText=""
									value={newTag}
									onChange={(e) => setNewTag(e.target.value)}
									placeholder="Add a tag"
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											addTag();
										}
									}}
								/>
								<Button size="sm" onClick={addTag}>Add</Button>
							</div>
							<div className={styles.tagsContainer}>
								{formData.tags.map(tag => (
									<Tag
										key={tag}
										type="blue"
										size="sm"
										onClose={() => removeTag(tag)}
									>
										{tag}
									</Tag>
								))}
							</div>
						</div>
					</Column>
				</Grid>

				<div className={styles.messagesSection}>
					<div className={styles.messagesHeader}>
						<h4>Conversation script</h4>
						<Button
							kind="tertiary"
							size="sm"
							renderIcon={Add}
							onClick={addMessage}
						>
                            Add message
						</Button>
					</div>

					{messages.length === 0 && (
						<Tile className={styles.emptyState}>
							<p>No messages yet. Add a message to start building your conversation script.</p>
						</Tile>
					)}

					{messages.map((message, index) => {
						const messageSequence = index + 1;
						const isUserMessage = message.role === 'user';
						const turnTarget = turnTargets[messageSequence];

						return (
							<Tile key={index} className={styles.messageItem}>
								<div className={styles.messageHeader}>
									<Select
										id={`role-${index}`}
										labelText="Role"
										value={message.role}
										onChange={(e) => updateMessage(index, { role: e.target.value as 'user' | 'system' })}
									>
										<SelectItem value="user" text="User" />
										<SelectItem value="system" text="System" />
									</Select>
									<div className={styles.messageActions}>
										<IconButton
											label="Move up"
											disabled={index === 0}
											onClick={() => moveMessage(index, 'up')}
										>
											<ArrowUp />
										</IconButton>
										<IconButton
											label="Move down"
											disabled={index === messages.length - 1}
											onClick={() => moveMessage(index, 'down')}
										>
											<ArrowDown />
										</IconButton>
										<IconButton
											label="Delete message"
											onClick={() => removeMessage(index)}
										>
											<TrashCan />
										</IconButton>
									</div>
								</div>
								<TextArea
									id={`content-${index}`}
									labelText="Content"
									value={message.content}
									onChange={(e) => updateMessage(index, { content: e.target.value })}
									placeholder="Enter message content"
									rows={3}
								/>
								{isUserMessage && (
									<div className={styles.targetSection}>
										<h6 className={styles.targetTitle}>Expected assistant reply (optional)</h6>
										<TextArea
											id={`target-${index}`}
											labelText=""
											value={turnTarget?.target_reply || ''}
											onChange={(e) => setTurnTargets(prev => ({
												...prev,
												[messageSequence]: {
													...prev[messageSequence],
													target_reply: e.target.value
												}
											}))}
											placeholder="Enter the expected assistant response for similarity scoring"
											rows={2}
										/>
										<div className={styles.targetOptions}>
											<TextInput
												id={`threshold-${index}`}
												labelText="Similarity threshold (0-100)"
												type="number"
												min={0}
												max={100}
												value={turnTarget?.threshold?.toString() || ''}
												onChange={(e) => setTurnTargets(prev => ({
													...prev,
													[messageSequence]: {
														...prev[messageSequence],
														threshold: e.target.value ? Number(e.target.value) : null
													}
												}))}
												placeholder="70"
											/>
											<TextInput
												id={`weight-${index}`}
												labelText="Weight"
												type="number"
												min={0}
												step={0.1}
												value={turnTarget?.weight?.toString() || ''}
												onChange={(e) => setTurnTargets(prev => ({
													...prev,
													[messageSequence]: {
														...prev[messageSequence],
														weight: e.target.value ? Number(e.target.value) : null
													}
												}))}
												placeholder="1.0"
											/>
										</div>
									</div>
								)}
							</Tile>
						);
					})}
				</div>
			</div>
		</Modal>
	);
}
