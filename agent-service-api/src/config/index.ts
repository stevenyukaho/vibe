import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Server configuration
export const SERVER_CONFIG = {
  port: process.env.PORT || 5003,
  host: process.env.HOST || 'localhost',
};

// Backend configuration for job polling
export const BACKEND_CONFIG = {
  url: process.env.BACKEND_URL || 'http://localhost:5000',
  timeout: Number(process.env.BACKEND_TIMEOUT) || 30000, // 30 seconds
};

// Default timeout for API requests (0 means no timeout)
export const DEFAULT_TIMEOUT = Number(process.env.DEFAULT_TIMEOUT) || 60000; // 60 seconds

// Health check interval in milliseconds
export const HEALTH_CHECK_INTERVAL = 60000; // 60 seconds
