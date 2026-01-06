"""
CACI AI Delivery Risk and Cost Signal Copilot - Backend Configuration
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Database
    database_url: str = "sqlite:///./data/copilot.db"
    
    # Hugging Face
    huggingface_api_key: str = ""
    huggingface_model: str = "mistralai/Mistral-7B-Instruct-v0.2"
    
    # API Settings
    api_prefix: str = "/api"
    debug: bool = True
    
    # Cost tracking (approximate costs per 1K tokens)
    cost_per_1k_input_tokens: float = 0.0001
    cost_per_1k_output_tokens: float = 0.0002
    
    # LLM Resilience
    llm_timeout: float = 60.0
    llm_max_retries: int = 3
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
