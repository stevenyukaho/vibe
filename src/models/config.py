from typing import List, Optional
from pydantic import BaseModel

class ModelConfig(BaseModel):
    provider: str
    model: str
    temperature: float
    max_tokens: int

class AgentConfig(BaseModel):
    role: str
    goal: str
    backstory: str
    allow_delegation: bool = False
    allow_code_execution: bool = False
    memory: bool = False
    verbose: bool = True
    tools: List[str] = []
    model_config: ModelConfig

class CrewConfig(BaseModel):
    process: str = "sequential"
    async_execution: bool = True
    max_retries: int = 3

class TestConfig(BaseModel):
    name: str
    description: Optional[str] = None
    input: str
    expected_outputs: List[str]
    agent_ids: List[int]
    crew_config: CrewConfig

class TestRequest(BaseModel):
    test_config: TestConfig
    agents: List[AgentConfig]
