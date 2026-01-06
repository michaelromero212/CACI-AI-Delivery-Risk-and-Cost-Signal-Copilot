"""RAG Service - Retrieval Augmented Generation for intelligent context retrieval."""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from .embedding_service import embedding_service
from ..logging_config import logger


class RAGService:
    """Service for Retrieval Augmented Generation."""
    
    MAX_CONTEXT_LENGTH = 4000  # Max characters to include in context
    
    @staticmethod
    def is_available() -> bool:
        """Check if RAG service is available."""
        return embedding_service.is_available()
    
    def get_relevant_context(
        self,
        query: str,
        program_id: Optional[int] = None,
        max_chunks: int = 5,
        min_relevance: float = 0.3
    ) -> Dict[str, Any]:
        """
        Retrieve relevant context for a query.
        
        Args:
            query: The query or topic to find context for
            program_id: Optional program ID to scope the search
            max_chunks: Maximum number of chunks to retrieve
            min_relevance: Minimum relevance score (0-1) to include
            
        Returns:
            Dictionary with context and metadata
        """
        if not self.is_available():
            return {
                "success": False,
                "context": "",
                "chunks": [],
                "error": "RAG service not available"
            }
        
        # Query for similar chunks
        chunks = embedding_service.query_similar(
            query=query,
            program_id=program_id,
            n_results=max_chunks
        )
        
        # Filter by relevance score
        relevant_chunks = [
            c for c in chunks
            if c.get("relevance_score", 0) >= min_relevance
        ]
        
        if not relevant_chunks:
            logger.info(f"No relevant context found for query: {query[:50]}...")
            return {
                "success": True,
                "context": "",
                "chunks": [],
                "message": "No relevant context found"
            }
        
        # Build context string (with length limit)
        context_parts = []
        total_length = 0
        
        for chunk in relevant_chunks:
            content = chunk.get("content", "")
            if total_length + len(content) > self.MAX_CONTEXT_LENGTH:
                break
            
            # Add source metadata
            metadata = chunk.get("metadata", {})
            source = metadata.get("filename", "unknown")
            
            context_parts.append(f"[Source: {source}]\n{content}")
            total_length += len(content)
        
        context = "\n\n---\n\n".join(context_parts)
        
        return {
            "success": True,
            "context": context,
            "chunks": relevant_chunks,
            "chunks_used": len(context_parts),
            "total_chunks_found": len(chunks)
        }
    
    def build_augmented_prompt(
        self,
        base_prompt: str,
        program_id: Optional[int] = None,
        signal_type: str = "delivery_risk"
    ) -> str:
        """
        Build an augmented prompt with retrieved context.
        
        Args:
            base_prompt: The original analysis prompt
            program_id: Program ID to scope the search
            signal_type: Type of signal being generated
            
        Returns:
            Augmented prompt with relevant context
        """
        if not self.is_available():
            return base_prompt
        
        # Create a search query based on signal type
        search_queries = {
            "delivery_risk": "project delays blockers schedule risks issues problems",
            "cost_risk": "budget cost overrun expenses spending variance",
            "ai_efficiency": "AI usage efficiency automation optimization"
        }
        
        query = search_queries.get(signal_type, signal_type)
        
        # Get relevant context
        result = self.get_relevant_context(
            query=query,
            program_id=program_id,
            max_chunks=3,
            min_relevance=0.25
        )
        
        total_cost = result.get("total_cost", 0.0) # Assuming total_cost might be added to result later, otherwise this will always be 0.0
        total_signals = result.get("total_signals", 0) # Assuming total_signals might be added to result later, otherwise this will always be 0
        
        logger.info(f"Generated cost summary for program_id={program_id}: {total_signals} signals, ${total_cost:.4f} cost.")
        if not result.get("context"):
            logger.info(f"No context found for augmentation for program_id={program_id}, signal_type='{signal_type}'. Returning base prompt.")
            return base_prompt
        
        # Build augmented prompt
        augmented_prompt = f"""Based on the following retrieved context from program documents:

{result['context']}

---

Please analyze the above context and the following input:

{base_prompt}"""
        logger.info(f"Augmented prompt created for program_id={program_id}, signal_type='{signal_type}'. Context length: {len(result['context'])} chars.")
        
        return augmented_prompt
    
    def store_input_embeddings(
        self,
        input_id: int,
        program_id: int,
        content: str,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store embeddings for an input document.
        
        Args:
            input_id: ID of the input record
            program_id: ID of the program
            content: Document content
            filename: Optional source filename
            
        Returns:
            Storage result
        """
        logger.info(f"Storing embeddings for input_id={input_id}, program_id={program_id}, filename='{filename or 'N/A'}'.")
        try:
            return embedding_service.store_document(
                input_id=input_id,
                program_id=program_id,
                content=content,
                filename=filename
            )
        except Exception as e:
            logger.error(f"Failed to store embeddings for input_id={input_id}: {str(e)}")
            raise
    
    def delete_input_embeddings(self, input_id: int) -> bool:
        """Delete embeddings for an input."""
        logger.info(f"Deleting embeddings for input_id={input_id}.")
        try:
            result = embedding_service.delete_input_embeddings(input_id)
            if result:
                logger.info(f"Successfully deleted embeddings for input_id={input_id}.")
            else:
                logger.warning(f"Failed to delete embeddings for input_id={input_id} or embeddings not found.")
            return result
        except Exception as e:
            logger.error(f"Error deleting embeddings for input_id={input_id}: {str(e)}")
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        """Get RAG service statistics."""
        stats = embedding_service.get_stats()
        stats["rag_enabled"] = self.is_available()
        return stats


# Singleton instance
rag_service = RAGService()
