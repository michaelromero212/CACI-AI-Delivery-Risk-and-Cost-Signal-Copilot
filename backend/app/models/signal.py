"""Signal model - represents AI-generated risk and cost signals."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from ..database import Base


class Signal(Base):
    """An AI-generated signal (risk, cost, efficiency) with explanation."""
    
    __tablename__ = "signals"
    
    id = Column(Integer, primary_key=True, index=True)
    input_id = Column(Integer, ForeignKey("inputs.id"), nullable=False, index=True)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False, index=True)
    
    # Signal type: delivery_risk, cost_risk, ai_efficiency
    signal_type = Column(String(50), nullable=False, index=True)
    
    # Signal value: LOW/MEDIUM/HIGH for risk, NORMAL/ANOMALOUS for cost
    signal_value = Column(String(50), nullable=False)
    
    # Confidence score (0.0 to 1.0)
    confidence_score = Column(Float, nullable=False)
    
    # Natural language explanation
    explanation = Column(Text, nullable=False)
    
    # Model information for transparency
    model_used = Column(String(100), nullable=True)
    
    # Status
    status = Column(String(50), default="active")  # active, overridden
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    input = relationship("Input", back_populates="signals")
    program = relationship("Program", back_populates="signals")
    cost_metric = relationship("CostMetric", back_populates="signal", uselist=False, cascade="all, delete-orphan")
    overrides = relationship("AnalystOverride", back_populates="signal", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Signal(id={self.id}, type='{self.signal_type}', value='{self.signal_value}')>"
