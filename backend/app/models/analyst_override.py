"""Analyst override model - tracks human-in-the-loop signal corrections."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


class AnalystOverride(Base):
    """A human analyst override of an AI-generated signal."""
    
    __tablename__ = "analyst_overrides"
    
    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, ForeignKey("signals.id"), nullable=False, index=True)
    
    # Override values
    original_value = Column(String(50), nullable=False)
    override_value = Column(String(50), nullable=False)
    
    # Mandatory justification for audit trail
    justification = Column(Text, nullable=False)
    
    # Analyst identification (no auth, just a name field)
    analyst_name = Column(String(100), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    signal = relationship("Signal", back_populates="overrides")
    
    def __repr__(self):
        return f"<AnalystOverride(id={self.id}, {self.original_value} -> {self.override_value})>"
