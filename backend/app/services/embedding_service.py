"""Embedding Service - Generate and store embeddings for RAG using FAISS."""
from __future__ import annotations

import os
import json
import pickle
from typing import List, Optional, Dict, Any

# Lazy imports for optional dependencies
_embedding_model = None
_faiss_index = None
_document_store = None

# Paths for persistence
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "embeddings")
INDEX_PATH = os.path.join(DATA_DIR, "faiss_index.pkl")
DOCS_PATH = os.path.join(DATA_DIR, "documents.json")


def _get_embedding_model():
    """Lazy initialization of sentence-transformers model."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Use a small, fast model for embeddings
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        except ImportError:
            return None
    return _embedding_model


def _load_index_and_docs():
    """Load FAISS index and document store from disk."""
    global _faiss_index, _document_store
    
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Load document store
    if os.path.exists(DOCS_PATH):
        with open(DOCS_PATH, 'r') as f:
            _document_store = json.load(f)
    else:
        _document_store = {"documents": [], "metadata": []}
    
    # Load FAISS index
    if os.path.exists(INDEX_PATH):
        try:
            with open(INDEX_PATH, 'rb') as f:
                _faiss_index = pickle.load(f)
        except Exception:
            _faiss_index = None
    
    return _faiss_index, _document_store


def _save_index_and_docs():
    """Save FAISS index and document store to disk."""
    global _faiss_index, _document_store
    
    os.makedirs(DATA_DIR, exist_ok=True)
    
    if _document_store is not None:
        with open(DOCS_PATH, 'w') as f:
            json.dump(_document_store, f)
    
    if _faiss_index is not None:
        with open(INDEX_PATH, 'wb') as f:
            pickle.dump(_faiss_index, f)


class EmbeddingService:
    """Service for generating and managing document embeddings using FAISS."""
    
    CHUNK_SIZE = 500  # Approximate characters per chunk
    CHUNK_OVERLAP = 50  # Overlap between chunks for context
    EMBEDDING_DIM = 384  # Dimension for all-MiniLM-L6-v2
    
    def __init__(self):
        self._initialized = False
    
    def _ensure_initialized(self):
        """Ensure FAISS and documents are loaded."""
        if not self._initialized:
            _load_index_and_docs()
            self._initialized = True
    
    @staticmethod
    def is_available() -> bool:
        """Check if embedding service is available."""
        model = _get_embedding_model()
        if model is None:
            return False
        try:
            import faiss
            return True
        except ImportError:
            return False
    
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks."""
        if not text or len(text) <= chunk_size:
            return [text] if text else []
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # Try to break at a sentence or word boundary
            if end < len(text):
                for sep in ['. ', '.\n', '\n\n', '\n', ' ']:
                    last_sep = text[start:end].rfind(sep)
                    if last_sep > chunk_size // 2:
                        end = start + last_sep + len(sep)
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - overlap
        
        return chunks
    
    def store_document(
        self,
        input_id: int,
        program_id: int,
        content: str,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """Chunk a document and store embeddings."""
        global _faiss_index, _document_store
        
        if not self.is_available():
            return {"success": False, "error": "Embedding service not available"}
        
        import faiss
        import numpy as np
        
        self._ensure_initialized()
        model = _get_embedding_model()
        
        if model is None:
            return {"success": False, "error": "Model not available"}
        
        # Chunk the document
        chunks = self.chunk_text(content)
        
        if not chunks:
            return {"success": False, "error": "No content to embed"}
        
        # Delete existing chunks for this input
        self.delete_input_embeddings(input_id)
        
        # Generate embeddings
        embeddings = model.encode(chunks)
        embeddings = np.array(embeddings).astype('float32')
        
        # Initialize or update FAISS index
        if _faiss_index is None:
            _faiss_index = faiss.IndexFlatL2(self.EMBEDDING_DIM)
        
        if _document_store is None:
            _document_store = {"documents": [], "metadata": []}
        
        # Add to index
        _faiss_index.add(embeddings)
        
        # Store documents and metadata
        for i, chunk in enumerate(chunks):
            _document_store["documents"].append(chunk)
            _document_store["metadata"].append({
                "input_id": input_id,
                "program_id": program_id,
                "chunk_index": i,
                "filename": filename or "unknown"
            })
        
        # Persist
        _save_index_and_docs()
        
        return {
            "success": True,
            "chunks_stored": len(chunks),
            "input_id": input_id,
            "program_id": program_id
        }
    
    def query_similar(
        self,
        query: str,
        program_id: Optional[int] = None,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """Query for similar document chunks."""
        global _faiss_index, _document_store
        
        if not self.is_available():
            return []
        
        import faiss
        import numpy as np
        
        self._ensure_initialized()
        model = _get_embedding_model()
        
        if model is None or _faiss_index is None or _document_store is None:
            return []
        
        if len(_document_store["documents"]) == 0:
            return []
        
        # Generate query embedding
        query_embedding = model.encode([query])
        query_embedding = np.array(query_embedding).astype('float32')
        
        # Search - get more results if filtering by program
        search_k = n_results * 3 if program_id else n_results
        search_k = min(search_k, len(_document_store["documents"]))
        
        distances, indices = _faiss_index.search(query_embedding, search_k)
        
        # Format results
        chunks = []
        for i, idx in enumerate(indices[0]):
            if idx < 0 or idx >= len(_document_store["documents"]):
                continue
            
            metadata = _document_store["metadata"][idx]
            
            # Filter by program if specified
            if program_id and metadata.get("program_id") != program_id:
                continue
            
            chunks.append({
                "content": _document_store["documents"][idx],
                "metadata": metadata,
                "distance": float(distances[0][i]),
                "relevance_score": 1 / (1 + float(distances[0][i]))  # Convert distance to score
            })
            
            if len(chunks) >= n_results:
                break
        
        return chunks
    
    def delete_input_embeddings(self, input_id: int) -> bool:
        """Delete all embeddings for a specific input."""
        global _faiss_index, _document_store
        
        self._ensure_initialized()
        
        if _document_store is None:
            return False
        
        # Find indices to keep
        indices_to_keep = []
        for i, meta in enumerate(_document_store["metadata"]):
            if meta.get("input_id") != input_id:
                indices_to_keep.append(i)
        
        if len(indices_to_keep) == len(_document_store["metadata"]):
            return True  # Nothing to delete
        
        # Rebuild store and index
        new_docs = [_document_store["documents"][i] for i in indices_to_keep]
        new_meta = [_document_store["metadata"][i] for i in indices_to_keep]
        
        _document_store = {"documents": new_docs, "metadata": new_meta}
        
        # Rebuild FAISS index
        if new_docs:
            import faiss
            import numpy as np
            
            model = _get_embedding_model()
            if model:
                embeddings = model.encode(new_docs)
                embeddings = np.array(embeddings).astype('float32')
                _faiss_index = faiss.IndexFlatL2(self.EMBEDDING_DIM)
                _faiss_index.add(embeddings)
        else:
            _faiss_index = None
        
        _save_index_and_docs()
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about stored embeddings."""
        self._ensure_initialized()
        
        if not self.is_available():
            return {"available": False}
        
        try:
            doc_count = len(_document_store["documents"]) if _document_store else 0
            return {
                "available": True,
                "total_chunks": doc_count,
                "model": "all-MiniLM-L6-v2",
                "backend": "FAISS"
            }
        except Exception:
            return {"available": False}


# Singleton instance
embedding_service = EmbeddingService()
