import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import agentRoutes from './routes/agents';
import testRoutes from './routes/tests';
import resultRoutes from './routes/results';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/agents', agentRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/results', resultRoutes);

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
