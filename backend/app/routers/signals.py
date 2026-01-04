"""Signals router - signal generation and retrieval."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Program, Input, Signal, CostMetric, AnalystOverride
from ..schemas import (
    SignalResponse,
    SignalListResponse,
    AnalysisRequest,
    AnalysisResponse,
    CostMetricResponse,
    OverrideResponse
)
from ..services import signal_generator

router = APIRouter(prefix="/signals", tags=["signals"])


def _signal_to_response(signal: Signal) -> SignalResponse:
    """Convert Signal model to response schema."""
    # Get cost metric if available
    cost_metric = None
    if signal.cost_metric:
        cost_metric = CostMetricResponse(
            id=signal.cost_metric.id,
            signal_id=signal.cost_metric.signal_id,
            tokens_input=signal.cost_metric.tokens_input,
            tokens_output=signal.cost_metric.tokens_output,
            tokens_total=signal.cost_metric.tokens_total,
            estimated_cost_usd=signal.cost_metric.estimated_cost_usd,
            model_name=signal.cost_metric.model_name,
            latency_ms=signal.cost_metric.latency_ms,
            created_at=signal.cost_metric.created_at
        )
    
    # Get latest override if any
    current_override = None
    if signal.overrides:
        latest = max(signal.overrides, key=lambda x: x.created_at)
        current_override = OverrideResponse(
            id=latest.id,
            signal_id=latest.signal_id,
            original_value=latest.original_value,
            override_value=latest.override_value,
            justification=latest.justification,
            analyst_name=latest.analyst_name,
            created_at=latest.created_at
        )
    
    return SignalResponse(
        id=signal.id,
        input_id=signal.input_id,
        program_id=signal.program_id,
        signal_type=signal.signal_type,
        signal_value=signal.signal_value,
        confidence_score=signal.confidence_score,
        explanation=signal.explanation,
        model_used=signal.model_used,
        status=signal.status,
        created_at=signal.created_at,
        cost_metric=cost_metric,
        current_override=current_override
    )


@router.get("", response_model=SignalListResponse)
def list_signals(
    program_id: Optional[int] = None,
    signal_type: Optional[str] = None,
    signal_value: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List signals with optional filters."""
    query = db.query(Signal).options(
        joinedload(Signal.cost_metric),
        joinedload(Signal.overrides)
    )
    
    if program_id:
        query = query.filter(Signal.program_id == program_id)
    if signal_type:
        query = query.filter(Signal.signal_type == signal_type)
    if signal_value:
        query = query.filter(Signal.signal_value == signal_value)
    
    signals = query.order_by(Signal.created_at.desc()).all()
    
    return SignalListResponse(
        signals=[_signal_to_response(s) for s in signals],
        total=len(signals)
    )


@router.get("/{signal_id}", response_model=SignalResponse)
def get_signal(
    signal_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific signal."""
    signal = db.query(Signal).options(
        joinedload(Signal.cost_metric),
        joinedload(Signal.overrides)
    ).filter(Signal.id == signal_id).first()
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    return _signal_to_response(signal)


@router.post("/analyze/input/{input_id}", response_model=AnalysisResponse)
async def analyze_input(
    input_id: int,
    db: Session = Depends(get_db)
):
    """Generate signals for a specific input."""
    input_obj = db.query(Input).filter(Input.id == input_id).first()
    if not input_obj:
        raise HTTPException(status_code=404, detail="Input not found")
    
    # Generate signals
    signals = await signal_generator.generate_signals(db, input_obj)
    db.commit()
    
    # Refresh to get complete data
    for signal in signals:
        db.refresh(signal)
    
    # Calculate totals
    total_tokens = sum(s.cost_metric.tokens_total if s.cost_metric else 0 for s in signals)
    total_cost = sum(s.cost_metric.estimated_cost_usd if s.cost_metric else 0 for s in signals)
    
    # Re-fetch with relationships
    signal_ids = [s.id for s in signals]
    signals = db.query(Signal).options(
        joinedload(Signal.cost_metric),
        joinedload(Signal.overrides)
    ).filter(Signal.id.in_(signal_ids)).all()
    
    return AnalysisResponse(
        signals_generated=len(signals),
        total_tokens=total_tokens,
        total_cost_usd=total_cost,
        signals=[_signal_to_response(s) for s in signals]
    )


@router.post("/analyze/program/{program_id}", response_model=AnalysisResponse)
async def analyze_program(
    program_id: int,
    db: Session = Depends(get_db)
):
    """Generate signals for all unanalyzed inputs in a program."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Get inputs that don't have signals yet
    inputs = db.query(Input).filter(
        Input.program_id == program_id,
        Input.status == "processed"
    ).outerjoin(Signal).filter(Signal.id == None).all()
    
    if not inputs:
        # Also include inputs with status processed that may need re-analysis
        inputs = db.query(Input).filter(
            Input.program_id == program_id,
            Input.status == "processed"
        ).all()
    
    all_signals = []
    for input_obj in inputs:
        signals = await signal_generator.generate_signals(db, input_obj)
        all_signals.extend(signals)
    
    db.commit()
    
    # Calculate totals
    total_tokens = sum(s.cost_metric.tokens_total if s.cost_metric else 0 for s in all_signals)
    total_cost = sum(s.cost_metric.estimated_cost_usd if s.cost_metric else 0 for s in all_signals)
    
    # Re-fetch with relationships
    signal_ids = [s.id for s in all_signals]
    if signal_ids:
        all_signals = db.query(Signal).options(
            joinedload(Signal.cost_metric),
            joinedload(Signal.overrides)
        ).filter(Signal.id.in_(signal_ids)).all()
    
    return AnalysisResponse(
        signals_generated=len(all_signals),
        total_tokens=total_tokens,
        total_cost_usd=total_cost,
        signals=[_signal_to_response(s) for s in all_signals]
    )
