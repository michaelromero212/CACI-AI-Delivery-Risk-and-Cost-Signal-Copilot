"""Programs router - CRUD operations for programs."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Program, Input, Signal
from ..schemas import (
    ProgramCreate,
    ProgramUpdate,
    ProgramResponse,
    ProgramListResponse
)

router = APIRouter(prefix="/programs", tags=["programs"])


def _program_to_response(program: Program, db: Session) -> ProgramResponse:
    """Convert Program model to response schema with counts."""
    input_count = db.query(func.count(Input.id)).filter(Input.program_id == program.id).scalar()
    signal_count = db.query(func.count(Signal.id)).filter(Signal.program_id == program.id).scalar()
    
    return ProgramResponse(
        id=program.id,
        name=program.name,
        description=program.description,
        status=program.status,
        created_at=program.created_at,
        updated_at=program.updated_at,
        input_count=input_count,
        signal_count=signal_count
    )


@router.get("", response_model=ProgramListResponse)
def list_programs(
    status: str = None,
    db: Session = Depends(get_db)
):
    """List all programs, optionally filtered by status."""
    query = db.query(Program)
    if status:
        query = query.filter(Program.status == status)
    
    programs = query.order_by(Program.created_at.desc()).all()
    
    return ProgramListResponse(
        programs=[_program_to_response(p, db) for p in programs],
        total=len(programs)
    )


@router.post("", response_model=ProgramResponse, status_code=201)
def create_program(
    program_data: ProgramCreate,
    db: Session = Depends(get_db)
):
    """Create a new program."""
    program = Program(
        name=program_data.name,
        description=program_data.description
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    
    return _program_to_response(program, db)


@router.get("/{program_id}", response_model=ProgramResponse)
def get_program(
    program_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific program by ID."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    return _program_to_response(program, db)


@router.patch("/{program_id}", response_model=ProgramResponse)
def update_program(
    program_id: int,
    program_data: ProgramUpdate,
    db: Session = Depends(get_db)
):
    """Update a program."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    if program_data.name is not None:
        program.name = program_data.name
    if program_data.description is not None:
        program.description = program_data.description
    if program_data.status is not None:
        program.status = program_data.status
    
    db.commit()
    db.refresh(program)
    
    return _program_to_response(program, db)


@router.delete("/{program_id}", status_code=204)
def delete_program(
    program_id: int,
    db: Session = Depends(get_db)
):
    """Delete a program and all associated data."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    db.delete(program)
    db.commit()
    
    return None
