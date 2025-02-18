import { Router } from 'express';
import type { Request, Response } from 'express';
import { createAgent, getAgents, getAgentById } from '../db/queries';
import type { Agent } from '../db/queries';

const router = Router();

// Get all agents
router.get('/', async (_req: Request, res: Response) => {
    try {
        const agents = await getAgents();
        res.json(agents);
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// Get agent by ID
router.get<{ id: string }>('/:id', async (req, res) => {
    try {
        const agent = await getAgentById(Number(req.params.id));
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json(agent);
    } catch (error) {
        console.error('Error fetching agent:', error);
        res.status(500).json({ error: 'Failed to fetch agent' });
    }
});

// Create new agent
router.post<{}, {}, Omit<Agent, 'id' | 'created_at'>>('/', async (req, res) => {
    try {
        const agent = await createAgent(req.body);
        res.status(201).json(agent);
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ error: 'Failed to create agent' });
    }
});

export default router; 