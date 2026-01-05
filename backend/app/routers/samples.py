"""Samples router - serves sample program data from the root sample_data directory."""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import List, Dict

router = APIRouter(prefix="/samples", tags=["samples"])

# Resolve the root sample_data directory
# Assuming this script is at backend/app/routers/samples.py
ROOT_DIR = Path(__file__).parent.parent.parent.parent
SAMPLE_DATA_DIR = ROOT_DIR / "sample_data"

@router.get("", response_model=Dict[str, Dict[str, List[Dict[str, str]]]])
async def list_samples():
    """List available sample files grouped by program."""
    if not SAMPLE_DATA_DIR.exists():
        raise HTTPException(status_code=404, detail="Sample data directory not found")
    
    samples = {}
    
    # Iterate through program subdirectories
    for prog_dir in SAMPLE_DATA_DIR.iterdir():
        if prog_dir.is_dir() and prog_dir.name.startswith("program_"):
            prog_name = prog_dir.name
            prog_samples = []
            
            for file in prog_dir.iterdir():
                if file.is_file() and not file.name.startswith("."):
                    prog_samples.append({
                        "name": file.name,
                        "path": f"{prog_name}/{file.name}"
                    })
            
            samples[prog_name] = prog_samples
            
    return {"samples": samples}

@router.get("/{program_name}/{filename}")
async def get_sample_content(program_name: str, filename: str):
    """Get the content of a specific sample file."""
    file_path = SAMPLE_DATA_DIR / program_name / filename
    
    # Security check: ensure the file is within the sample_data directory
    if not str(file_path.resolve()).startswith(str(SAMPLE_DATA_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Sample file not found")
        
    try:
        with open(file_path, "r") as f:
            content = f.read()
        return {"filename": filename, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")
