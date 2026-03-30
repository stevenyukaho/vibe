FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy entire source first (workspace prepare scripts need source files)
COPY . .

# Patch config source BEFORE npm install (which triggers build:packages)
RUN sed -i "s|NEXT_PUBLIC_API_URL: z.string().default('http://localhost:5000')|NEXT_PUBLIC_API_URL: z.string().default('')|" packages/config/src/index.ts
RUN sed -i "s|BACKEND_URL: z.string().default('http://localhost:5000')|BACKEND_URL: z.string().default('')|" packages/config/src/index.ts

# Install all dependencies (triggers workspace prepare/build scripts)
RUN npm install

# Build backend and agent-service-api
RUN cd backend && npx tsc -b
RUN cd agent-service-api && npx tsc -b

# Hardcode the API URL in the frontend to use relative paths (same-origin proxy)
RUN sed -i "1s|.*|// patched for Docker: use same-origin proxy|" frontend/src/lib/api/fetchJson.ts && \
    sed -i "s|frontendConfig.apiUrl|''|g" frontend/src/lib/api/fetchJson.ts

# Build frontend for production
ENV NEXT_PUBLIC_API_URL=""
RUN cd frontend && npx next build

# --- Runtime stage ---
FROM node:20-slim

WORKDIR /app

# Copy everything from builder
COPY --from=builder /app /app

# Create data directory for SQLite
RUN mkdir -p /app/backend/data

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
