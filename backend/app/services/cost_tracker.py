"""Cost tracker - aggregates and reports AI usage costs."""
from typing import Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..models import CostMetric, Signal
from ..logging_config import logger


class CostTracker:
    """Tracks and reports AI usage costs for transparency."""
    
    def get_summary(self, db: Session, program_id: int = None) -> Dict[str, Any]:
        """Get aggregated cost summary, optionally filtered by program."""
        query = db.query(
            func.count(CostMetric.id).label("total_signals"),
            func.sum(CostMetric.tokens_total).label("total_tokens"),
            func.sum(CostMetric.estimated_cost_usd).label("total_cost")
        )
        
        if program_id:
            query = query.join(Signal).filter(Signal.program_id == program_id)
        
        result = query.first()
        
        total_signals = result.total_signals or 0
        total_tokens = result.total_tokens or 0
        total_cost = result.total_cost or 0.0
        
        logger.info(f"Generated cost summary for program_id={program_id}: {total_signals} signals, ${total_cost:.4f} cost.")
        
        # Get model breakdown
        model_query = db.query(
            CostMetric.model_name,
            func.count(CostMetric.id).label("count"),
            func.sum(CostMetric.tokens_total).label("tokens"),
            func.sum(CostMetric.estimated_cost_usd).label("cost")
        ).group_by(CostMetric.model_name)
        
        if program_id:
            model_query = model_query.join(Signal).filter(Signal.program_id == program_id)
        
        model_breakdown = {}
        for row in model_query.all():
            model_breakdown[row.model_name] = {
                "invocations": row.count,
                "tokens": row.tokens or 0,
                "cost_usd": round(row.cost or 0.0, 6)
            }
        
        return {
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 6),
            "total_signals": total_signals,
            "avg_cost_per_signal": round(total_cost / total_signals, 6) if total_signals > 0 else 0.0,
            "avg_tokens_per_signal": round(total_tokens / total_signals) if total_signals > 0 else 0,
            "model_breakdown": model_breakdown
        }
    
    def get_recent_costs(
        self,
        db: Session,
        limit: int = 20,
        program_id: int = None
    ) -> list:
        """Get recent cost metrics."""
        query = db.query(CostMetric).join(Signal)
        
        if program_id:
            query = query.filter(Signal.program_id == program_id)
        
        return query.order_by(CostMetric.created_at.desc()).limit(limit).all()


# Singleton instance
cost_tracker = CostTracker()
