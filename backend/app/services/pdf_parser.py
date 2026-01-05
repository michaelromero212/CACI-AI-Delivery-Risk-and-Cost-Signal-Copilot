"""PDF Parser Service - Extract text from PDF documents."""
from typing import Optional
import io

try:
    from pypdf import PdfReader
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False


class PDFParser:
    """Parse PDF documents and extract text content."""
    
    @staticmethod
    def is_available() -> bool:
        """Check if PDF parsing is available."""
        return PDF_SUPPORT
    
    @staticmethod
    def extract_text(file_content: bytes) -> str:
        """
        Extract text content from a PDF file.
        
        Args:
            file_content: Raw bytes of the PDF file
            
        Returns:
            Extracted text as a string
        """
        if not PDF_SUPPORT:
            raise RuntimeError("PDF support not available. Install pypdf: pip install pypdf")
        
        try:
            pdf_file = io.BytesIO(file_content)
            reader = PdfReader(pdf_file)
            
            text_parts = []
            for page_num, page in enumerate(reader.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {page_num} ---\n{page_text}")
            
            return "\n\n".join(text_parts) if text_parts else ""
            
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")
    
    @staticmethod
    def get_metadata(file_content: bytes) -> dict:
        """
        Extract metadata from a PDF file.
        
        Args:
            file_content: Raw bytes of the PDF file
            
        Returns:
            Dictionary containing PDF metadata
        """
        if not PDF_SUPPORT:
            return {"error": "PDF support not available"}
        
        try:
            pdf_file = io.BytesIO(file_content)
            reader = PdfReader(pdf_file)
            
            metadata = {
                "num_pages": len(reader.pages),
                "title": reader.metadata.title if reader.metadata else None,
                "author": reader.metadata.author if reader.metadata else None,
                "subject": reader.metadata.subject if reader.metadata else None,
            }
            
            return {k: v for k, v in metadata.items() if v is not None}
            
        except Exception as e:
            return {"error": str(e)}


# Singleton instance
pdf_parser = PDFParser()
