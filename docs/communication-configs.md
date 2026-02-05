# Communication configs: request templates, response maps, and variables

This document describes how VIBE models and uses agent communication configs for External API agents.

## Data model

- `agent_request_templates`:
  - `id`, `agent_id`, `name`, `description`, `engine` (default `handlebars`-like), `content_type` (default `application/json`), `body` (string), `tags`, `is_default` (0/1), `created_at`
  - Unique per agent: `(agent_id, name)` and one default per agent.
- `agent_response_maps`:
  - `id`, `agent_id`, `name`, `description`, `spec` (string), `tags`, `is_default` (0/1), `created_at`
  - Unique per agent: `(agent_id, name)` and one default per agent.
- `conversations` additions:
  - `default_request_template_id`, `default_response_map_id`, `variables` (JSON string).
- `conversation_messages` additions:
  - `request_template_id`, `response_map_id`, `set_variables` (JSON string).
- `execution_sessions` additions:
  - `variables` (JSON snapshot after execution).

## Selection logic

Per user message:

1. Use message override (`request_template_id`/`response_map_id`) if set
2. Else use conversation defaults if set
3. Else use the agent defaults

The agent-service-api resolves the effective template/map and embeds them in per-message metadata for execution.

## Request templates

Templates are JSON strings using placeholders:

- `{{input}}` - the current user message (string-escaped)
- `{{conversation_history}}` - the accumulated transcript (string-escaped)
- `{{myVar}}`, `{{a.b.c}}` - variables injected from the merged variables map

Authors can omit quotes around placeholders to embed objects (e.g., `"payload": {{myObject}}`).

## Response maps

`spec` is a JSON string with fields:

```json
{
  "output": "choices.0.message.content",
  "intermediate_steps": "usage",
  "variables": {
    "sessionId": "id",
    "firstToolCall": "tool_calls[0].id"
  },
  "success_criteria": {
    "type": "contains",
    "value": "success"
  }
}
```

- Paths support dot (`choices.0`) and bracket (`tool_calls[0].id`) notation.
- `variables` extracted each turn are merged into the session variable accumulator.

## Variables

Merge order (later wins):

1. Conversation-level `variables`
2. Accumulated session variables from prior turns (extracted via response maps)
3. Per-message `set_variables`

Note: A future enhancement may support binding expressions like `$.lastResponse.id`. For now, message `set_variables` are treated as literals (strings/JSON).

The final accumulated variables are persisted on the execution session.

## Migration

On startup, VIBE migrates any legacy `agents.settings.request_template` and `agents.settings.response_mapping` into the new tables as `default` entries and removes them from agent settings.

## UI

- Agent detail page ("Communication" tab): manage request templates and response maps, set default, and preview template rendering with sample inputs/variables.
- Conversation builder: edit conversation-level variables; per-message overrides and `set_variables` for user messages.
- Session viewer: shows per-turn template/map usage and variable counts; session-level variables appear in the header.
