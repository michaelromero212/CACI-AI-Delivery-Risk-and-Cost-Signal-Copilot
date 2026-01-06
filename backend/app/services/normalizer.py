"""Input normalizer - parses and normalizes CSV/TXT/manual inputs."""
import csv
import io
import json
from typing import Tuple, Optional
from ..logging_config import logger


class InputNormalizer:
    """Normalizes different input types into structured content."""
    
    def normalize(
        self,
        raw_content: str,
        input_type: str,
        filename: Optional[str] = None
    ) -> Tuple[str, dict]:
        """
        Normalize input content based on type.
        
        Returns:
            Tuple of (normalized_content, metadata)
        """
        raw_content = self._sanitize(raw_content)
        
        if input_type == "csv":
            return self._normalize_csv(raw_content, filename)
        elif input_type == "txt":
            return self._normalize_txt(raw_content, filename)
        else:  # manual
            return self._normalize_manual(raw_content)
    
    def _sanitize(self, content: str) -> str:
        """Sanitize input content for security and performance."""
        if not content:
            return ""
            
        # Strip trailing/leading whitespace
        sanitized = content.strip()
        
        # Protect against common injection patterns or formatting artifacts
        # (Simplified for the accelerator context)
        sanitized = sanitized.replace("\x00", "") # Null bytes
        
        # Hard truncation for performance (prevent context window blowouts)
        max_length = 50000 
        if len(sanitized) > max_length:
            logger.warning(f"Input truncated from {len(sanitized)} to {max_length} characters.")
            sanitized = sanitized[:max_length] + "... [Truncated for processing performance]"
            
        return sanitized
    
    def _normalize_csv(
        self,
        raw_content: str,
        filename: Optional[str]
    ) -> Tuple[str, dict]:
        """Parse and normalize CSV content."""
        try:
            reader = csv.DictReader(io.StringIO(raw_content))
            rows = list(reader)
            headers = reader.fieldnames or []
            
            # Create normalized summary
            summary_parts = []
            for i, row in enumerate(rows[:20]):  # Limit to first 20 rows for summary
                row_summary = ", ".join(f"{k}: {v}" for k, v in row.items() if v)
                summary_parts.append(f"Row {i+1}: {row_summary}")
            
            normalized = "\n".join(summary_parts)
            
            # Detect content type from filename or headers
            content_type = self._detect_csv_type(filename, headers)
            
            metadata = {
                "format": "csv",
                "row_count": len(rows),
                "columns": headers,
                "content_type": content_type,
                "filename": filename
            }
            
            logger.info(f"Processed CSV: {filename or 'unknown'} ({len(rows)} rows). Detected as {content_type}.")
            return normalized, metadata
            
        except Exception as e:
            return raw_content, {
                "format": "csv",
                "parse_error": str(e),
                "filename": filename
            }
    
    def _normalize_txt(
        self,
        raw_content: str,
        filename: Optional[str]
    ) -> Tuple[str, dict]:
        """Parse and normalize text content."""
        lines = raw_content.strip().split("\n")
        
        # Detect document type
        content_type = self._detect_txt_type(raw_content, filename)
        
        # Extract key sections
        sections = self._extract_sections(raw_content)
        
        # Create normalized version
        normalized = raw_content.strip()
        
        metadata = {
            "format": "txt",
            "line_count": len(lines),
            "word_count": len(raw_content.split()),
            "content_type": content_type,
            "sections": list(sections.keys()),
            "filename": filename
        }
        
        return normalized, metadata
    
    def _normalize_manual(self, raw_content: str) -> Tuple[str, dict]:
        """Normalize manual text input."""
        lines = raw_content.strip().split("\n")
        
        metadata = {
            "format": "manual",
            "line_count": len(lines),
            "word_count": len(raw_content.split()),
            "content_type": "analyst_input"
        }
        
        return raw_content.strip(), metadata
    
    def _detect_csv_type(
        self,
        filename: Optional[str],
        headers: list
    ) -> str:
        """Detect the type of CSV content."""
        if filename:
            fname_lower = filename.lower()
            if "risk" in fname_lower:
                return "risk_register"
            if "cost" in fname_lower or "burn" in fname_lower:
                return "cost_summary"
            if "milestone" in fname_lower:
                return "milestones"
            if "ai" in fname_lower or "usage" in fname_lower:
                return "ai_usage"
        
        # Check headers
        headers_lower = [h.lower() for h in headers]
        if any("risk" in h for h in headers_lower):
            return "risk_register"
        if any("cost" in h or "spend" in h for h in headers_lower):
            return "cost_summary"
        if any("milestone" in h for h in headers_lower):
            return "milestones"
        
        return "general_data"
    
    def _detect_txt_type(
        self,
        content: str,
        filename: Optional[str]
    ) -> str:
        """Detect the type of text content."""
        if filename:
            fname_lower = filename.lower()
            if "status" in fname_lower:
                return "status_report"
            if "note" in fname_lower:
                return "analyst_notes"
        
        content_lower = content.lower()
        if "weekly" in content_lower and "status" in content_lower:
            return "status_report"
        if "analyst" in content_lower or "observation" in content_lower:
            return "analyst_notes"
        
        return "general_document"
    
    def _extract_sections(self, content: str) -> dict:
        """Extract sections from document based on common patterns."""
        sections = {}
        current_section = "introduction"
        current_content = []
        
        for line in content.split("\n"):
            # Check for section headers (lines that look like headers)
            stripped = line.strip()
            if stripped and (
                stripped.isupper() or
                stripped.endswith(":") or
                stripped.startswith("##") or
                stripped.startswith("**")
            ):
                # Save previous section
                if current_content:
                    sections[current_section] = "\n".join(current_content)
                # Start new section
                current_section = stripped.lower().replace(":", "").replace("#", "").replace("*", "").strip()
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_content:
            sections[current_section] = "\n".join(current_content)
        
        return sections


# Singleton instance
normalizer = InputNormalizer()
