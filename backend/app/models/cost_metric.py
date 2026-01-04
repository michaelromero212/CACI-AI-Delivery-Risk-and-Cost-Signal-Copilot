"""Cost metric model - tracks AI usage costs for transparency."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


class CostMetric(Base):
    """Token usage and cost tracking for a signal generation."""
    
    __tablename__ = "cost_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, ForeignKey("signals.id"), nullable=False, unique=True)
    
    # Token counts
    tokens_input = Column(Integer, nullable=False, default=0)
    tokens_output = Column(Integer, nullable=False, default=0)
    tokens_total = Column(Integer, nullable=False, default=0)
    
    # Cost in USD
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    
    # Model information
    model_name = Column(String(100), nullable=False)
    
    # Performance
    latency_ms = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    signal = relationship("Signal", back_populates="cost_metric")
    
    def __repr__(self):
        return f"<CostMetric(id={self.id}, tokens={self.tokens_total}, cost=${self.estimated_cost_usd:.6f})>"
