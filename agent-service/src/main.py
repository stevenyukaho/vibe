from fastapi import FastAPI, HTTPException
from .models import TestExecutionRequest, TestExecutionResponse
from .agent_executor import AgentExecutor
from .config import settings
import traceback
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Agent Testing Service")
executor = AgentExecutor()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

@app.get("/test-connection")
async def test_connection():
    """Test endpoint that doesn't rely on CrewAI."""
    try:
        logger.debug("Test connection endpoint called")
        return {
            "status": "success",
            "message": "Connection to agent service is working",
            "details": {
                "host": settings.HOST,
                "port": settings.PORT
            }
        }
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.error(f"Error in test connection: {str(e)}")
        logger.error(f"Traceback: {error_traceback}")
        raise HTTPException(status_code=500, detail=f"Error in test connection: {str(e)}")

@app.post("/execute-test")
async def execute_test(request: TestExecutionRequest) -> TestExecutionResponse:
    """Execute a test with the given configuration."""
    try:
        response = executor.execute_test(
            agent_configs=request.agent_configs,
            crew_config=request.crew_config,
            test_input=request.test_input,
            test_id=1  # TODO: Handle test ID properly
        )
        return response
    except Exception as e:
        # Get the full traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Error executing test: {str(e)}")
        logger.error(f"Traceback: {error_traceback}")
        
        # Return more detailed error information
        raise HTTPException(status_code=500, 
                           detail=f"Error executing test: {str(e)}. Traceback: {error_traceback}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
