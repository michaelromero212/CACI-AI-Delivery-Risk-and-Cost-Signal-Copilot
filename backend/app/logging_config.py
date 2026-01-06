import logging
import sys
from typing import Optional

def setup_logging(level: int = logging.INFO, name: Optional[str] = "copilot"):
    """
    Configure standard logging for the CACI Copilot application.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid duplicate handlers if already configured
    if not logger.handlers:
        # Standard format reflecting professional observability
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
        )
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
    return logger

# Primary logger instance
logger = setup_logging()
