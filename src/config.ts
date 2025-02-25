// Configuration for the backend application

// Agent service configuration
export const agentServiceConfig = {
  url: process.env.AGENT_SERVICE_URL || 'http://localhost:5002',
  timeout: parseInt(process.env.AGENT_SERVICE_TIMEOUT || '60000', 10), // 60 seconds
};

// Server configuration
export const serverConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || 'localhost',
};

// Database configuration
export const dbConfig = {
  path: process.env.DB_PATH || './data/agent-testing.db',
}; 