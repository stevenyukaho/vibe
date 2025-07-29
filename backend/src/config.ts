// Configuration for the backend application

// Agent service configuration
export const agentServiceConfig = {
  url: process.env.AGENT_SERVICE_URL || 'http://localhost:5002',
  timeout: 0, // No timeout
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

// Default pagination settings for large resources
export const paginationConfig = {
  // Default maximum number of rows to return when the client does not specify limit/offset
  // Applies to potentially large tables such as results, jobs and suite-runs
  defaultLargeLimit: 50,
};
