from crewai import Agent, Task, Crew
from datetime import datetime
import time
import logging
import traceback
from typing import List
from langchain_community.llms import Ollama

from .models import AgentConfig, CrewConfig, TestExecutionResponse, IntermediateStep, Metrics

# Get logger
logger = logging.getLogger(__name__)

class AgentExecutor:
    def __init__(self):
        self.intermediate_steps: List[IntermediateStep] = []
        self.metrics = {
            "token_usage": 0,
            "model_calls": 0,
            "tool_calls": 0
        }
    
    def _create_agent(self, config: AgentConfig) -> Agent:
        """Create a CrewAI agent from configuration."""
        try:
            # Create Ollama LLM instance
            llm = Ollama(
                model=config.llm_config.model,
                temperature=config.llm_config.temperature,
                base_url=config.llm_config.base_url
            )

            agent = Agent(
                role=config.role,
                goal=config.goal,
                backstory=config.backstory,
                allow_delegation=config.allow_delegation,
                allow_code_execution=config.allow_code_execution,
                memory=config.memory,
                verbose=config.verbose,
                llm=llm  # Use the Ollama LLM instance
            )

            return agent
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"Error creating agent: {str(e)}")
            logger.error(f"Traceback: {error_traceback}")
            raise

    def _log_step(self, agent_id: int, action: str, output: str):
        """Log an intermediate step."""
        try:
            step = IntermediateStep(
                timestamp=datetime.utcnow().isoformat(),
                agent_id=agent_id,
                action=action,
                output=output
            )
            self.intermediate_steps.append(step)
        except Exception as e:
            logger.error(f"Error logging step: {str(e)}")
            # Create a simplified step if there's an error
            step = IntermediateStep(
                timestamp=datetime.utcnow().isoformat(),
                agent_id=agent_id,
                action="error",
                output=f"Error logging step: {str(e)}"
            )
            self.intermediate_steps.append(step)

    def execute_test(
        self,
        agent_configs: List[AgentConfig],
        crew_config: CrewConfig,
        test_input: str,
        test_id: int
    ) -> TestExecutionResponse:
        """Execute a test with the given configuration."""
        start_time = time.time()
        
        try:
            # Create agents
            agents = [self._create_agent(config) for config in agent_configs]
            
            # Create task
            task = Task(
                description=test_input,
                agent=agents[0]  # For now, assign to first agent
            )
            
            # Create crew
            crew = Crew(
                agents=agents,
                tasks=[task],
                process=crew_config.process,
                async_execution=crew_config.async_execution,
                max_retries=crew_config.max_retries
            )
            
            # Execute - Note: crew.kickoff() returns a string, not a coroutine
            result = crew.kickoff()  # Removed await since it's not async
            
            # Calculate execution time
            execution_time = time.time() - start_time
            
            # Create response
            response = TestExecutionResponse(
                agent_id=1,  # TODO: Handle multiple agents
                test_id=test_id,
                output=result,
                success=True,  # TODO: Implement success criteria
                execution_time=execution_time,
                intermediate_steps=self.intermediate_steps,
                metrics=Metrics(**self.metrics)
            )
            
            return response
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"Error in execute_test: {str(e)}")
            logger.error(f"Traceback: {error_traceback}")
            self._log_step(0, "error", f"{str(e)}\n{error_traceback}")
            raise
