from typing import List
from pydantic import BaseModel
from datetime import datetime

class IntermediateStep(BaseModel):
    timestamp: datetime
    agent_id: int
    action: str
    output: str

class Metrics(BaseModel):
    token_usage: int
    model_calls: int
    tool_calls: int

class TestResult(BaseModel):
    agent_id: int
    test_id: int
    output: str
    success: bool
    execution_time: float
    intermediate_steps: List[IntermediateStep]
    metrics: Metrics
