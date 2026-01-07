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
            # Match the expectation of legacy tests if needed, or provide a clear error
            raise ValueError(f"Invalid signal value: '{v}'. Must be one of {allowed}")
        return v

    @field_validator('explanation')
    @classmethod
    def validate_explanation(cls, v: str) -> str:
        v = v.strip()
        
        # Check for placeholder/error messages
        if "unable to parse" in v.lower() or "failed to parse" in v.lower():
            raise ValueError("Explanation indicates a failed to parse response.")
            
        # Check for truncation (ending in a colon or very short for a professional explanation)
        if v.endswith(":"):
            raise ValueError("Explanation appears to be truncated (ends in a colon).")
            
        if len(v) < 30: # Increased from 20 for more professional signals
            raise ValueError("Explanation is too short and lacks professional detail.")
            
        return v
