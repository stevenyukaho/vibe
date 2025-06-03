import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import agentRoutes from './routes/agents';
import testRoutes from './routes/tests';
import resultRoutes from './routes/results';
import executeRoutes from './routes/execute';
import jobsRoutes from './routes/jobs';
import testSuiteRoutes from './routes/test-suites';
import executeSuiteRoutes from './routes/execute-suite';
import suiteRunsRoutes from './routes/suite-runs';
import llmConfigRoutes from './routes/llm-configs';
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
app.use('/api/jobs', jobsRoutes);
app.use('/api/test-suites', testSuiteRoutes);
app.use('/api/execute-suite', executeSuiteRoutes);
app.use('/api/suite-runs', suiteRunsRoutes);
app.use('/api/llm-configs', llmConfigRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
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
