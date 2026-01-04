"""Overrides router - human-in-the-loop signal corrections."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Signal, AnalystOverride
from ..schemas import OverrideCreate, OverrideResponse, OverrideListResponse

router = APIRouter(prefix="/overrides", tags=["overrides"])


@router.post("/signal/{signal_id}", response_model=OverrideResponse, status_code=201)
def create_override(
    signal_id: int,
    override_data: OverrideCreate,
    db: Session = Depends(get_db)
):
    """Create an analyst override for a signal."""
    signal = db.query(Signal).filter(Signal.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    # Create override
    override = AnalystOverride(
        signal_id=signal_id,
        original_value=signal.signal_value,
        override_value=override_data.override_value,
        justification=override_data.justification,
        analyst_name=override_data.analyst_name
    )
    db.add(override)
    
    # Update signal status
    signal.status = "overridden"
    
    db.commit()
    db.refresh(override)
    
    return override


@router.get("/signal/{signal_id}", response_model=OverrideListResponse)
def list_signal_overrides(
    signal_id: int,
    db: Session = Depends(get_db)
):
    """List all overrides for a signal."""
    signal = db.query(Signal).filter(Signal.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    overrides = db.query(AnalystOverride).filter(
        AnalystOverride.signal_id == signal_id
    ).order_by(AnalystOverride.created_at.desc()).all()
    
    return OverrideListResponse(
        overrides=overrides,
        total=len(overrides)
    )


@router.get("", response_model=OverrideListResponse)
def list_all_overrides(
    program_id: int = None,
    db: Session = Depends(get_db)
):
    """List all overrides, optionally filtered by program."""
    query = db.query(AnalystOverride)
    
    if program_id:
        query = query.join(Signal).filter(Signal.program_id == program_id)
    
    overrides = query.order_by(AnalystOverride.created_at.desc()).all()
    
    return OverrideListResponse(
        overrides=overrides,
        total=len(overrides)
    )
