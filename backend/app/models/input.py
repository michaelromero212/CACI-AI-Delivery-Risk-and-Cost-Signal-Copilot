"""Input model - represents uploaded files or manual text inputs."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class Input(Base):
    """An input document (CSV, TXT, or manual text) associated with a program."""
    
    __tablename__ = "inputs"
    
    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False, index=True)
    
    # Input type: csv, txt, manual
    input_type = Column(String(50), nullable=False)
    filename = Column(String(255), nullable=True)  # Null for manual inputs
    
    # Content
    raw_content = Column(Text, nullable=False)
    normalized_content = Column(Text, nullable=True)  # Processed/cleaned content
    
    # Metadata extracted during normalization
    metadata_json = Column(JSON, nullable=True)
    
    # Status
    status = Column(String(50), default="pending")  # pending, processed, error
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    program = relationship("Program", back_populates="inputs")
    signals = relationship("Signal", back_populates="input", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Input(id={self.id}, type='{self.input_type}', filename='{self.filename}')>"
