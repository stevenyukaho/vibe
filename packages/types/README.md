# @ibm-vibe/types

Shared TypeScript definitions for the IBM VIBE project.

## Purpose

This package serves as the **Single Source of Truth** for all data models used across the application.
It prevents type drift between the Frontend, Backend, and Agent Services.

## Contents

- **Core Entities**: `Agent`, `Job`, `Test`, `TestResult`
- **Conversation Models**: `Conversation`, `ConversationMessage`, `ExecutionSession`, `SessionMessage`
- **Configuration**: `LLMConfig`, `TestSuite`
- **API objects**: Request/Response interfaces for API communication

## Usage

Import directly in other workspaces:

```typescript
import { Agent, Job } from '@ibm-vibe/types';
```

## Workflow

1. **Modify**: Edit `index.ts` to add or change a type.
2. **Build**: The build step is handled automatically by the root `npm install` or `npm run build:types`.
3. **Consume**: Changes are immediately available to other services (restart of dev servers may be required).
