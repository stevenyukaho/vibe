FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy entire source first (workspace prepare scripts need source files)
COPY . .

# Install all dependencies (triggers workspace prepare/build scripts)
RUN npm install

# Patch config default to use same-origin proxy (empty string)
RUN sed -i "s|NEXT_PUBLIC_API_URL: zod_1.z.string().default('http://localhost:5000')|NEXT_PUBLIC_API_URL: zod_1.z.string().default('')|" packages/config/dist/index.js

# Build backend and agent-service-api
RUN cd backend && npx tsc -b
RUN cd agent-service-api && npx tsc -b

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
