"""Inputs router - file upload and manual input handling."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Program, Input
from ..schemas import InputCreate, InputResponse, InputDetailResponse
from ..services import normalizer

router = APIRouter(prefix="/inputs", tags=["inputs"])


@router.get("/program/{program_id}", response_model=List[InputResponse])
def list_program_inputs(
    program_id: int,
    db: Session = Depends(get_db)
):
    """List all inputs for a program."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    inputs = db.query(Input).filter(Input.program_id == program_id).order_by(Input.created_at.desc()).all()
    return inputs


@router.post("/program/{program_id}/upload", response_model=InputResponse, status_code=201)
async def upload_file(
    program_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a CSV or TXT file."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Determine file type
    filename = file.filename or "unknown"
    if filename.lower().endswith(".csv"):
        input_type = "csv"
    elif filename.lower().endswith(".txt"):
        input_type = "txt"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only CSV and TXT files are accepted."
        )
    
    # Read file content
    try:
        content = await file.read()
        raw_content = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Normalize content
    normalized_content, metadata = normalizer.normalize(raw_content, input_type, filename)
    
    # Create input record
    input_obj = Input(
        program_id=program_id,
        input_type=input_type,
        filename=filename,
        raw_content=raw_content,
        normalized_content=normalized_content,
        metadata_json=metadata,
        status="processed"
    )
    db.add(input_obj)
    db.commit()
    db.refresh(input_obj)
    
    return input_obj


@router.post("/program/{program_id}/manual", response_model=InputResponse, status_code=201)
def create_manual_input(
    program_id: int,
    input_data: InputCreate,
    db: Session = Depends(get_db)
):
    """Create a manual text input."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Normalize content
    normalized_content, metadata = normalizer.normalize(input_data.content, "manual")
    
    # Create input record
    input_obj = Input(
        program_id=program_id,
        input_type="manual",
        filename=None,
        raw_content=input_data.content,
        normalized_content=normalized_content,
        metadata_json=metadata,
        status="processed"
    )
    db.add(input_obj)
    db.commit()
    db.refresh(input_obj)
    
    return input_obj


@router.get("/{input_id}", response_model=InputDetailResponse)
def get_input(
    input_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed input information."""
    input_obj = db.query(Input).filter(Input.id == input_id).first()
    if not input_obj:
        raise HTTPException(status_code=404, detail="Input not found")
    
    return input_obj


@router.delete("/{input_id}", status_code=204)
def delete_input(
    input_id: int,
    db: Session = Depends(get_db)
):
    """Delete an input and its signals."""
    input_obj = db.query(Input).filter(Input.id == input_id).first()
    if not input_obj:
        raise HTTPException(status_code=404, detail="Input not found")
    
    db.delete(input_obj)
    db.commit()
    
    return None
