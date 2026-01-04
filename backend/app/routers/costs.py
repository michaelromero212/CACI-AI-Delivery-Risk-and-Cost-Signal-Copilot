"""Costs router - cost transparency and metrics."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import CostSummaryResponse
from ..services import cost_tracker

router = APIRouter(prefix="/costs", tags=["costs"])


@router.get("/summary", response_model=CostSummaryResponse)
def get_cost_summary(
    program_id: int = None,
    db: Session = Depends(get_db)
):
    """Get aggregated cost summary."""
    summary = cost_tracker.get_summary(db, program_id)
    return CostSummaryResponse(**summary)
