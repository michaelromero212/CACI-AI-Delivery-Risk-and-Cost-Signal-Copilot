"""
Unit tests for the CACI AI Delivery Risk & Cost Signal Copilot API.
Requires Python 3.9+ for full compatibility with modern test libraries.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db


# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client():
    """Create a fresh test client for each test."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    # Use TestClient without context manager for broader compatibility
    test_client = TestClient(app)
    yield test_client
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


# ============ Health Check Tests ============

class TestHealthCheck:
    """Tests for the health check endpoint."""
    
    def test_health_check_returns_healthy(self, client):
        """Test that health check returns healthy status."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert data["service"] == "CACI AI Delivery Risk & Cost Signal Copilot"


# ============ Program CRUD Tests ============

class TestPrograms:
    """Tests for program CRUD operations."""
    
    def test_create_program(self, client):
        """Test creating a new program."""
        response = client.post(
            "/api/programs",
            json={"name": "Test Program", "description": "A test program"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Program"
        assert data["description"] == "A test program"
        assert data["id"] is not None
        assert data["status"] == "active"
    
    def test_create_program_without_description(self, client):
        """Test creating a program with only name."""
        response = client.post(
            "/api/programs",
            json={"name": "Minimal Program"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Program"
        assert data["description"] is None
    
    def test_create_program_empty_name_fails(self, client):
        """Test that empty name is rejected."""
        response = client.post(
            "/api/programs",
            json={"name": ""}
        )
        assert response.status_code == 422  # Validation error
    
    def test_list_programs_empty(self, client):
        """Test listing programs when none exist."""
        response = client.get("/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert data["programs"] == []
        assert data["total"] == 0
    
    def test_list_programs(self, client):
        """Test listing multiple programs."""
        # Create two programs
        client.post("/api/programs", json={"name": "Program 1"})
        client.post("/api/programs", json={"name": "Program 2"})
        
        response = client.get("/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert len(data["programs"]) == 2
        assert data["total"] == 2
    
    def test_get_program(self, client):
        """Test getting a specific program."""
        # Create a program
        create_response = client.post(
            "/api/programs",
            json={"name": "Get Test", "description": "Testing get"}
        )
        program_id = create_response.json()["id"]
        
        # Get the program
        response = client.get(f"/api/programs/{program_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Get Test"
        assert data["id"] == program_id
    
    def test_get_nonexistent_program(self, client):
        """Test getting a program that doesn't exist."""
        response = client.get("/api/programs/99999")
        assert response.status_code == 404
    
    def test_update_program(self, client):
        """Test updating a program."""
        # Create a program
        create_response = client.post(
            "/api/programs",
            json={"name": "Original Name"}
        )
        program_id = create_response.json()["id"]
        
        # Update it
        response = client.patch(
            f"/api/programs/{program_id}",
            json={"name": "Updated Name", "description": "New description"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "New description"
    
    def test_delete_program(self, client):
        """Test deleting a program."""
        # Create a program
        create_response = client.post(
            "/api/programs",
            json={"name": "To Delete"}
        )
        program_id = create_response.json()["id"]
        
        # Delete it
        response = client.delete(f"/api/programs/{program_id}")
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = client.get(f"/api/programs/{program_id}")
        assert get_response.status_code == 404


# ============ Input Tests ============

class TestInputs:
    """Tests for input endpoints."""
    
    def test_create_manual_input(self, client):
        """Test creating a manual text input."""
        # Create a program first
        program_response = client.post(
            "/api/programs",
            json={"name": "Input Test Program"}
        )
        program_id = program_response.json()["id"]
        
        # Create manual input
        response = client.post(
            f"/api/inputs/program/{program_id}/manual",
            json={"content": "This is a test status update with some risk indicators."}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["input_type"] == "manual"
        assert data["status"] == "processed"
        assert data["program_id"] == program_id
    
    def test_list_program_inputs(self, client):
        """Test listing inputs for a program."""
        # Create a program
        program_response = client.post(
            "/api/programs",
            json={"name": "List Inputs Program"}
        )
        program_id = program_response.json()["id"]
        
        # Create inputs
        client.post(
            f"/api/inputs/program/{program_id}/manual",
            json={"content": "Input 1"}
        )
        client.post(
            f"/api/inputs/program/{program_id}/manual",
            json={"content": "Input 2"}
        )
        
        # List inputs
        response = client.get(f"/api/inputs/program/{program_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


# ============ Signal Tests ============

class TestSignals:
    """Tests for signal generation endpoints."""
    
    def test_analyze_input(self, client):
        """Test analyzing an input to generate signals."""
        # Create program and input
        program_response = client.post(
            "/api/programs",
            json={"name": "Signal Test Program"}
        )
        program_id = program_response.json()["id"]
        
        input_response = client.post(
            f"/api/inputs/program/{program_id}/manual",
            json={"content": "The project is experiencing delays. Critical blockers identified."}
        )
        input_id = input_response.json()["id"]
        
        # Analyze
        response = client.post(f"/api/signals/analyze/input/{input_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["signals_generated"] >= 1
        assert len(data["signals"]) >= 1
        
        # Check signal structure
        signal = data["signals"][0]
        assert "signal_type" in signal
        assert "signal_value" in signal
        assert "confidence_score" in signal
        assert "explanation" in signal
    
    def test_list_signals(self, client):
        """Test listing signals."""
        response = client.get("/api/signals")
        assert response.status_code == 200
        data = response.json()
        assert "signals" in data
        assert "total" in data


# ============ Cost Transparency Tests ============

class TestCosts:
    """Tests for cost transparency endpoints."""
    
    def test_get_cost_summary(self, client):
        """Test getting cost summary."""
        response = client.get("/api/costs/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_tokens" in data
        assert "total_cost_usd" in data
        assert "total_signals" in data
        assert "avg_cost_per_signal" in data
        assert "model_breakdown" in data


# ============ Override Tests ============

class TestOverrides:
    """Tests for analyst override endpoints."""
    
    def test_create_override(self, client):
        """Test creating an analyst override."""
        # Create program, input, and signal
        program_response = client.post(
            "/api/programs",
            json={"name": "Override Test Program"}
        )
        program_id = program_response.json()["id"]
        
        input_response = client.post(
            f"/api/inputs/program/{program_id}/manual",
            json={"content": "Some test content for override testing"}
        )
        input_id = input_response.json()["id"]
        
        analyze_response = client.post(f"/api/signals/analyze/input/{input_id}")
        signal_id = analyze_response.json()["signals"][0]["id"]
        
        # Create override
        response = client.post(
            f"/api/overrides/signal/{signal_id}",
            json={
                "override_value": "HIGH",
                "justification": "Based on additional information not in the input.",
                "analyst_name": "Test Analyst"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["override_value"] == "HIGH"
        assert data["analyst_name"] == "Test Analyst"
        assert len(data["justification"]) >= 10
    
    def test_list_overrides(self, client):
        """Test listing all overrides."""
        response = client.get("/api/overrides")
        assert response.status_code == 200
        data = response.json()
        assert "overrides" in data
        assert "total" in data
