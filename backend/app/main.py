"""
CACI AI Delivery Risk and Cost Signal Copilot - FastAPI Application

An ESF-aligned AI accelerator that surfaces early delivery risk,
cost anomalies, and AI usage efficiency signals across government programs.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import (
    programs_router,
    inputs_router,
    signals_router,
    costs_router,
    overrides_router
)

settings = get_settings()

# Create FastAPI application
app = FastAPI(
    title="CACI AI Delivery Risk & Cost Signal Copilot",
    description="""
    An ESF-aligned AI accelerator for surfacing early delivery risk,
    cost anomalies, and AI usage efficiency signals across government programs.
    
    ## Features
    - **Program Management**: Track multiple government programs
    - **Input Ingestion**: Upload CSV, TXT, or enter manual text
    - **Signal Generation**: AI-assisted risk and cost signal detection
    - **Cost Transparency**: Token usage and cost tracking
    - **Human-in-the-Loop**: Analyst override capabilities
    """,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(programs_router, prefix="/api")
app.include_router(inputs_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(costs_router, prefix="/api")
app.include_router(overrides_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "CACI AI Delivery Risk & Cost Signal Copilot",
        "llm_mode": "real" if settings.huggingface_api_key else "fallback-demo",
        "model": settings.huggingface_model
    }


@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "message": "CACI AI Delivery Risk & Cost Signal Copilot API",
        "documentation": "/api/docs",
        "health": "/api/health"
    }
