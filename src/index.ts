import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import agentRoutes from './routes/agents';
import testRoutes from './routes/tests';
import resultRoutes from './routes/results';
import executeRoutes from './routes/execute';
import { serverConfig } from './config';

const app = express();
const port = serverConfig.port;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/agents', agentRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/execute', executeRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

// Basic error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
