import express from 'express';
import cors from 'cors';
import routes from './routes';
import { SERVER_CONFIG } from './config';
import { jobPoller } from './services/job-poller';

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/', routes);

// Default 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message || 'Unknown error'
  });
});

// Start server
const { port, host } = SERVER_CONFIG;
app.listen(port, () => {
  console.log(`API Agent Service running at http://${host}:${port}`);
  console.log('Press Ctrl+C to stop');
  
  // Start job poller
  jobPoller.startPolling();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  jobPoller.stopPolling();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  jobPoller.stopPolling();
  process.exit(0);
});
