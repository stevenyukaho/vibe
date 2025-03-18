import uvicorn
import logging
from src.config import settings

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('agent-service.log')
    ]
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info(f"Starting agent service on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level="debug"
    )
