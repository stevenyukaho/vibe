import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db/database';
import {
	createConversation,
	getConversations,
	getConversationById,
	updateConversation,
	deleteConversation,
	getConversationsWithCount,
	addMessageToConversation,
	getConversationMessages,
	updateConversationMessage,
	deleteConversationMessage,
	reorderConversationMessages
} from '../db/queries';
import type { Conversation, ConversationMessage } from '../types';
import { hasPaginationParams, validatePaginationOrError } from '../utils/pagination';

const router = Router();

// Get all conversations
router.get('/', (async (req: Request, res: Response) => {
	try {
		if (hasPaginationParams(req)) {
			const queryParams = validatePaginationOrError(req, res);
			if (!queryParams) {
				return;
			}

			const { data, total } = getConversationsWithCount(queryParams);

			return res.json({
				data,
				total,
				limit: queryParams.limit,
				offset: queryParams.offset
			});
		}

		const conversations = await getConversations();
		return res.json(conversations);
	} catch (error) {
		console.error('Error fetching conversations:', error);
		return res.status(500).json({ error: 'Failed to fetch conversations' });
	}
}) as any);

// Get conversation by ID (includes messages)
router.get('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);
		const conversation = await getConversationById(conversationId);

		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		// Get messages for this conversation
		const messages = await getConversationMessages(conversationId);

		return res.json({
			...conversation,
			messages
		});
	} catch (error) {
		console.error('Error fetching conversation:', error);
		return res.status(500).json({ error: 'Failed to fetch conversation' });
	}
}) as any);

// Create new conversation
router.post('/', (async (req: Request<{}, {}, Omit<Conversation, 'id' | 'created_at' | 'updated_at'> & { messages?: Omit<ConversationMessage, 'id' | 'conversation_id' | 'created_at'>[] }>, res: Response) => {
	try {
		const {
			name,
			description,
			tags,
			default_request_template_id,
			default_response_map_id,
			variables,
			stop_on_failure,
			messages
		} = req.body;

		// Validate required fields
		if (!name) {
			return res.status(400).json({
				error: 'Failed to create conversation',
				details: 'Name is required'
			});
		}

		// Create conversation
		const conversation = await createConversation({
			name,
			description,
			tags,
			default_request_template_id,
			default_response_map_id,
			variables,
			stop_on_failure
		});

		// Add messages if provided
		if (messages && messages.length > 0) {
			const createdMessages = [];
			for (let i = 0; i < messages.length; i++) {
				const message = messages[i];
				const createdMessage = await addMessageToConversation({
					conversation_id: conversation.id!,
					sequence: message.sequence || i + 1,
					role: message.role,
					content: message.content,
					metadata: message.metadata,
					request_template_id: (message as any).request_template_id,
					response_map_id: (message as any).response_map_id,
					set_variables: (message as any).set_variables
				});
				createdMessages.push(createdMessage);
			}

			return res.status(201).json({
				...conversation,
				messages: createdMessages
			});
		}

		return res.status(201).json(conversation);
	} catch (error) {
		console.error('Error creating conversation:', error);
		return res.status(500).json({
			error: 'Failed to create conversation',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

// Update conversation
router.put('/:id', (async (req: Request<{ id: string }, {}, Partial<Conversation> & { messages?: Omit<ConversationMessage, 'id' | 'conversation_id' | 'created_at'>[] }>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);
		const { messages, ...conversationData } = req.body;

		// Update conversation metadata
		const conversation = await updateConversation(conversationId, conversationData);
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		// Handle messages if provided
		if (messages) {
			// Delete existing messages
			const deleteStmt = db.prepare('DELETE FROM conversation_messages WHERE conversation_id = ?');
			deleteStmt.run(conversationId);

			// Add new messages
			const updatedMessages = [];
			for (let i = 0; i < messages.length; i++) {
				const message = messages[i];
				const createdMessage = await addMessageToConversation({
					conversation_id: conversationId,
					sequence: message.sequence || i + 1,
					role: message.role,
					content: message.content,
					metadata: message.metadata,
					request_template_id: (message as any).request_template_id,
					response_map_id: (message as any).response_map_id,
					set_variables: (message as any).set_variables
				});
				updatedMessages.push(createdMessage);
			}

			return res.json({
				...conversation,
				messages: updatedMessages
			});
		}

		return res.json(conversation);
	} catch (error) {
		console.error('Error updating conversation:', error);
		return res.status(500).json({ error: 'Failed to update conversation' });
	}
}) as any);

// Delete conversation
router.delete('/:id', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const id = Number(req.params.id);

		// Check if conversation exists
		const existingConversation = await getConversationById(id);
		if (!existingConversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		await deleteConversation(id);
		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting conversation:', error);
		return res.status(500).json({
			error: 'Failed to delete conversation',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

// Get messages for a conversation
router.get('/:id/messages', (async (req: Request<{ id: string }>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);

		// Check if conversation exists
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		const messages = await getConversationMessages(conversationId);
		return res.json(messages);
	} catch (error) {
		console.error('Error fetching conversation messages:', error);
		return res.status(500).json({ error: 'Failed to fetch conversation messages' });
	}
}) as any);

// Add message to conversation
router.post('/:id/messages', (async (req: Request<{ id: string }, {}, Omit<ConversationMessage, 'id' | 'conversation_id' | 'created_at'>>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);
		const { sequence, role, content, metadata } = req.body;

		// Check if conversation exists
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		// Validate required fields
		if (!role || !content) {
			return res.status(400).json({
				error: 'Failed to create message',
				details: 'Role and content are required fields'
			});
		}

		// If no sequence provided, set as next in order
		let messageSequence = sequence;
		if (!messageSequence) {
			const existingMessages = await getConversationMessages(conversationId);
			messageSequence = existingMessages.length + 1;
		}

		const message = await addMessageToConversation({
			conversation_id: conversationId,
			sequence: messageSequence,
			role,
			content,
			metadata,
			request_template_id: (req.body as any).request_template_id,
			response_map_id: (req.body as any).response_map_id,
			set_variables: (req.body as any).set_variables
		});

		return res.status(201).json(message);
	} catch (error) {
		console.error('Error creating message:', error);
		return res.status(500).json({
			error: 'Failed to create message',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

// Update message in conversation
router.put('/:id/messages/:messageId', (async (req: Request<{ id: string; messageId: string }, {}, Partial<ConversationMessage>>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);
		const messageId = Number(req.params.messageId);

		// Check if conversation exists
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		const message = await updateConversationMessage(messageId, req.body);
		if (!message) {
			return res.status(404).json({ error: 'Message not found' });
		}

		return res.json(message);
	} catch (error) {
		console.error('Error updating message:', error);
		return res.status(500).json({ error: 'Failed to update message' });
	}
}) as any);

// Delete message from conversation
router.delete('/:id/messages/:messageId', (async (req: Request<{ id: string; messageId: string }>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);
		const messageId = Number(req.params.messageId);

		// Check if conversation exists
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		await deleteConversationMessage(messageId);
		return res.status(204).send();
	} catch (error) {
		console.error('Error deleting message:', error);
		return res.status(500).json({
			error: 'Failed to delete message',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

// Reorder messages in conversation
router.put('/:id/messages/reorder', (async (req: Request<{ id: string }, {}, { messages: { id: number; sequence: number }[] }>, res: Response) => {
	try {
		const conversationId = Number(req.params.id);
		const { messages } = req.body;

		// Check if conversation exists
		const conversation = await getConversationById(conversationId);
		if (!conversation) {
			return res.status(404).json({ error: 'Conversation not found' });
		}

		if (!messages || !Array.isArray(messages)) {
			return res.status(400).json({
				error: 'Invalid request',
				details: 'messages array is required'
			});
		}

		await reorderConversationMessages(conversationId, messages);

		// Return updated messages
		const updatedMessages = await getConversationMessages(conversationId);
		return res.json(updatedMessages);
	} catch (error) {
		console.error('Error reordering messages:', error);
		return res.status(500).json({
			error: 'Failed to reorder messages',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}) as any);

export default router;
