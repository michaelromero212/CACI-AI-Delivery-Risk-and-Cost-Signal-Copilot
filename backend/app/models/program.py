"""Program model - represents a government program being tracked."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from ..database import Base


class Program(Base):
    """A government program being monitored for delivery risk and cost signals."""
    
    __tablename__ = "programs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="active")  # active, archived
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    inputs = relationship("Input", back_populates="program", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="program", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Program(id={self.id}, name='{self.name}')>"
