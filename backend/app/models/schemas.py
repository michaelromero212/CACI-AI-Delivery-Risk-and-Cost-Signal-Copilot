from pydantic import BaseModel, Field, field_validator
from typing import Optional

class LLMSignalResponse(BaseModel):
    """Structured response from LLM for a signal assessment."""
    signal_value: str = Field(..., description="The value of the signal (e.g., HIGH, NORMAL, etc.)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="The confidence score between 0 and 1")
    explanation: str = Field(..., min_length=20, description="A professional explanation of the signal")

    @field_validator('signal_value')
    @classmethod
    def validate_signal_value(cls, v: str) -> str:
        v = v.upper().strip()
        allowed = ["LOW", "MEDIUM", "HIGH", "NORMAL", "ANOMALOUS", "MODERATE"]
        if v not in allowed:
            raise ValueError(f"Signal value '{v}' is not in allowed list: {allowed}")
        return v
