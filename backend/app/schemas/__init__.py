"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


# ============ Program Schemas ============

class ProgramCreate(BaseModel):
    """Schema for creating a new program."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ProgramUpdate(BaseModel):
    """Schema for updating a program."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None


class ProgramResponse(BaseModel):
    """Schema for program response."""
    id: int
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    input_count: int = 0
    signal_count: int = 0
    
    class Config:
        from_attributes = True


class ProgramListResponse(BaseModel):
    """Schema for list of programs."""
    programs: List[ProgramResponse]
    total: int


# ============ Input Schemas ============

class InputCreate(BaseModel):
    """Schema for manual text input."""
    content: str = Field(..., min_length=1)
    input_type: str = "manual"


class InputResponse(BaseModel):
    """Schema for input response."""
    id: int
    program_id: int
    input_type: str
    filename: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: datetime
    metadata_json: Optional[dict] = None
    
    class Config:
        from_attributes = True


class InputDetailResponse(InputResponse):
    """Schema for detailed input response with content."""
    raw_content: str
    normalized_content: Optional[str]


# ============ Signal Schemas ============

class SignalResponse(BaseModel):
    """Schema for signal response."""
    id: int
    input_id: int
    program_id: int
    signal_type: str
    signal_value: str
    confidence_score: float
    explanation: str
    model_used: Optional[str]
    status: str
    created_at: datetime
    
    # Include cost if available
    cost_metric: Optional["CostMetricResponse"] = None
    
    # Include latest override if any
    current_override: Optional["OverrideResponse"] = None
    
    class Config:
        from_attributes = True


class SignalListResponse(BaseModel):
    """Schema for list of signals."""
    signals: List[SignalResponse]
    total: int


# ============ Cost Metric Schemas ============

class CostMetricResponse(BaseModel):
    """Schema for cost metric response."""
    id: int
    signal_id: int
    tokens_input: int
    tokens_output: int
    tokens_total: int
    estimated_cost_usd: float
    model_name: str
    latency_ms: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CostSummaryResponse(BaseModel):
    """Schema for aggregated cost summary."""
    total_tokens: int
    total_cost_usd: float
    total_signals: int
    avg_cost_per_signal: float
    avg_tokens_per_signal: float
    model_breakdown: Dict[str, Any]


# ============ Override Schemas ============

class OverrideCreate(BaseModel):
    """Schema for creating an analyst override."""
    override_value: str = Field(..., min_length=1)
    justification: str = Field(..., min_length=10)
    analyst_name: str = Field(..., min_length=1, max_length=100)


class OverrideResponse(BaseModel):
    """Schema for override response."""
    id: int
    signal_id: int
    original_value: str
    override_value: str
    justification: str
    analyst_name: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class OverrideListResponse(BaseModel):
    """Schema for list of overrides."""
    overrides: List[OverrideResponse]
    total: int


# ============ Analysis Schemas ============

class AnalysisRequest(BaseModel):
    """Schema for triggering analysis."""
    input_ids: Optional[List[int]] = None  # Analyze specific inputs, or all pending if None


class AnalysisResponse(BaseModel):
    """Schema for analysis result."""
    signals_generated: int
    total_tokens: int
    total_cost_usd: float
    signals: List[SignalResponse]


# Forward reference resolution
SignalResponse.model_rebuild()
