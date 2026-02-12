import { JobStatus as JobStatusEnum } from '@ibm-vibe/types';
import type {
	Agent,
	Test,
	TestResult,
	RequestTemplate,
	ResponseMap,
	AgentLinkedTemplate,
	AgentLinkedResponseMap,
	PaginatedResponse,
	StatsResponse,
	LLMRequestOptions,
	LLMResponse,
	Conversation,
	ConversationMessage,
	ExecutionSession,
	SessionMessage,
	ConversationTurnTarget,
	Job as SharedJob,
	TestSuite as SharedTestSuite,
	SuiteRun as SharedSuiteRun,
	SuiteEntry as SharedSuiteEntry,
	LLMConfig as SharedLLMConfig
} from '@ibm-vibe/types';

export type { Agent, Test, TestResult, RequestTemplate, ResponseMap, AgentLinkedTemplate, AgentLinkedResponseMap };
export type { Conversation, ConversationMessage, ExecutionSession, SessionMessage, ConversationTurnTarget };
export type { PaginatedResponse, StatsResponse, LLMRequestOptions, LLMResponse };

export type LLMConfig = SharedLLMConfig;

export interface AgentRequestTemplate {
	id: number;
	name: string;
	body: string;
	description?: string;
	engine?: string;
	content_type?: string;
	tags?: string;
	capabilities?: string | null;
	is_default?: number;
	created_at?: string;
	updated_at?: string;
}

export interface AgentResponseMap {
	id: number;
	name: string;
	spec: string;
	description?: string;
	tags?: string;
	capabilities?: string | null;
	is_default?: number;
	created_at?: string;
	updated_at?: string;
}

export type JobStatus = Lowercase<keyof typeof JobStatusEnum>;

export type Job = Omit<SharedJob, 'status' | 'progress' | 'created_at' | 'updated_at'> & {
	status: JobStatus;
	progress: number;
	created_at: string;
	updated_at: string;
};

export type TestSuite = Omit<SharedTestSuite, 'id'> & { id: number; test_count?: number };

export type SuiteRun = Omit<SharedSuiteRun, 'id' | 'status' | 'progress' | 'started_at'> & {
	id: number;
	status: JobStatus;
	progress: number;
	started_at: string;
};

export type SuiteEntry = SharedSuiteEntry;
