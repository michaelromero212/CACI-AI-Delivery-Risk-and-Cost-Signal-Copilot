"""
CACI AI Delivery Risk and Cost Signal Copilot - Database Setup
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import get_settings

settings = get_settings()

# Support both SQLite and PostgreSQL via DATABASE_URL
database_url = os.environ.get("DATABASE_URL", settings.database_url)

# Handle SQLite-specific connect args
if database_url.startswith("sqlite"):
    # Ensure data directory exists for SQLite
    db_path = database_url.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from .models import program, input, signal, cost_metric, analyst_override
    Base.metadata.create_all(bind=engine)
