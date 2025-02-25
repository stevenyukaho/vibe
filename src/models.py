from pydantic import BaseModel
from typing import List, Optional, Dict, Literal

class ModelConfig(BaseModel):
    provider: Literal["ollama"] = "ollama"  # For now we only support ollama
    model: str  # e.g., "llama2", "mistral", "codellama"
    temperature: float = 0.7
    max_tokens: int = 1000
    base_url: str = "http://localhost:11434"  # Default Ollama URL

class AgentConfig(BaseModel):
    role: str
    goal: str
    backstory: str
    allow_delegation: bool = False
    allow_code_execution: bool = False
    memory: bool = False
    verbose: bool = True
    tools: List[str] = []
    llm_config: ModelConfig

class CrewConfig(BaseModel):
    process: Literal["sequential", "hierarchical"] = "sequential"
    async_execution: bool = True
    max_retries: int = 3

class TestExecutionRequest(BaseModel):
    agent_configs: List[AgentConfig]
    crew_config: CrewConfig
    test_input: str

class IntermediateStep(BaseModel):
    timestamp: str
    agent_id: int
    action: str
    output: str

class Metrics(BaseModel):
    token_usage: int
    model_calls: int
    tool_calls: int

class TestExecutionResponse(BaseModel):
    agent_id: int
    test_id: int
    output: str
    success: bool
    execution_time: float
    intermediate_steps: List[IntermediateStep]
    metrics: Metrics
