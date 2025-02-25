from fastapi import FastAPI, HTTPException
from .models import TestExecutionRequest, TestExecutionResponse
from .agent_executor import AgentExecutor
from .config import settings

app = FastAPI(title="AI Agent Testing Service")
executor = AgentExecutor()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

@app.post("/execute-test")
async def execute_test(request: TestExecutionRequest) -> TestExecutionResponse:
    """Execute a test with the given configuration."""
    try:
        response = await executor.execute_test(
            agent_configs=request.agent_configs,
            crew_config=request.crew_config,
            test_input=request.test_input,
            test_id=1  # TODO: Handle test ID properly
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
