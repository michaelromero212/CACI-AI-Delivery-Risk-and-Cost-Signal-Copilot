"""RAG router - endpoints for RAG status and management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db

router = APIRouter(prefix="/rag", tags=["rag"])


@router.get("/status")
def get_rag_status():
    """Get RAG service status and statistics."""
    try:
        from ..services.rag_service import rag_service
        stats = rag_service.get_stats()
        return {
            "status": "available" if stats.get("available") else "unavailable",
            "rag_enabled": stats.get("rag_enabled", False),
            "total_chunks": stats.get("total_chunks", 0),
            "embedding_model": stats.get("model", "not loaded"),
            "description": "Retrieval Augmented Generation for semantic document search"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@router.post("/reindex/{program_id}")
def reindex_program(program_id: int, db: Session = Depends(get_db)):
    """Reindex all documents for a program."""
    from ..models import Input
    from ..services.rag_service import rag_service
    
    if not rag_service.is_available():
        raise HTTPException(status_code=503, detail="RAG service not available")
    
    # Get all inputs for the program
    inputs = db.query(Input).filter(Input.program_id == program_id).all()
    
    if not inputs:
        raise HTTPException(status_code=404, detail="No inputs found for program")
    
    results = []
    for input_obj in inputs:
        content = input_obj.normalized_content or input_obj.raw_content
        if content:
            result = rag_service.store_input_embeddings(
                input_id=input_obj.id,
                program_id=program_id,
                content=content,
                filename=input_obj.filename
            )
            results.append({
                "input_id": input_obj.id,
                "success": result.get("success", False),
                "chunks_stored": result.get("chunks_stored", 0)
            })
    
    return {
        "program_id": program_id,
        "inputs_processed": len(results),
        "results": results
    }


@router.delete("/clear/{program_id}")
def clear_program_embeddings(program_id: int, db: Session = Depends(get_db)):
    """Clear all embeddings for a program."""
    from ..models import Input
    from ..services.rag_service import rag_service
    
    if not rag_service.is_available():
        raise HTTPException(status_code=503, detail="RAG service not available")
    
    # Get all inputs for the program
    inputs = db.query(Input).filter(Input.program_id == program_id).all()
    
    deleted = 0
    for input_obj in inputs:
        if rag_service.delete_input_embeddings(input_obj.id):
            deleted += 1
    
    return {
        "program_id": program_id,
        "embeddings_deleted": deleted
    }
