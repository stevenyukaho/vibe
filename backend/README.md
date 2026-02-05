# Backend Service

The central API server for IBM VIBE. It handles 

## Architecture

- **Database**: SQLite (via `better-sqlite3`)
- **API**: Express REST API
- **Types**: Shared interfaces from `@ibm-vibe/types`

## Setup

1. **Install Dependencies**:
   Run `npm install` in the project root to link the workspace packages.

   ```bash
   # In project root
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and adjust settings.

   ```bash
   cp .env.example .env
   ```

   **Note**: The backend does NOT auto-load `.env` files. Environment variables must be exported to `process.env` (e.g., `export $(cat .env | xargs)`) or provided by runner scripts like `start-instance.sh`. The backend uses `@ibm-vibe/config` which reads from `process.env`.

3. **Run Service**:

   ```bash
   npm run dev
   ```

## Development

The backend relies on the shared types package. If you modify `packages/types`, you may need to restart the backend dev server to pick up changes.
