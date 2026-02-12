# Legacy endpoints and migration map

This document tracks transition endpoints that preserve `test_id` compatibility while the platform moves to the conversation-first model.

## Active legacy endpoints

### `POST /api/execute`

- **Input:** `agent_id`, `test_id`
- **Behavior:** resolves `test_id` to `conversation_id`, validates single-turn compatibility, then enqueues a conversation job.
- **Preferred replacement:** `POST /api/execute/conversation` with `conversation_id`.

### `POST /api/jobs`

- **Input:** `agent_id`, `test_id`
- **Behavior:** legacy compatibility endpoint with the same resolver path as `POST /api/execute`.
- **Preferred replacement:** `POST /api/execute` for legacy test runs, then move to `POST /api/execute/conversation`.

## Shared legacy adapter boundary

Legacy resolution now runs through `backend/src/services/legacy-execution.ts`:

- `test_id -> conversation_id` mapping
- Agent/test existence checks
- Single-turn compatibility validation
- Job enqueueing

Routes should call this service instead of implementing their own conversion logic.

## Removal criteria

Legacy test endpoints can be removed after:

1. Frontend no longer submits `test_id` execution payloads.
2. Job creation clients use conversation IDs only.
3. No remaining production traffic relies on `/api/jobs` legacy creation.
