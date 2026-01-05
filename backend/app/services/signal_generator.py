"""Signal generator - creates risk and cost signals using LLM."""
import re
from typing import List, Tuple
from sqlalchemy.orm import Session
from ..models import Input, Signal, CostMetric
from .llm_client import llm_client


class SignalGenerator:
    """Generates AI-assisted signals from normalized inputs."""
    
    SIGNAL_TYPES = ["delivery_risk", "cost_risk", "ai_efficiency"]
    
    PROMPTS = {
        "delivery_risk": """You are an expert program analyst assessing delivery risk for government programs.

Analyze the following input and determine the DELIVERY RISK level.

INPUT:
{content}

METADATA:
{metadata}

Based on this information, provide your assessment in the following format:
SIGNAL_VALUE: [LOW, MEDIUM, or HIGH]
CONFIDENCE: [0.0 to 1.0]
EXPLANATION: [2-3 sentence explanation of key risk factors]

Focus on schedule delays, resource constraints, dependency issues, and scope changes.""",

        "cost_risk": """You are an expert cost analyst reviewing program financials.

Analyze the following input and determine if there are COST ANOMALIES.

INPUT:
{content}

METADATA:
{metadata}

Based on this information, provide your assessment in the following format:
SIGNAL_VALUE: [NORMAL or ANOMALOUS]
CONFIDENCE: [0.0 to 1.0]
EXPLANATION: [2-3 sentence explanation of cost indicators]

Focus on budget variances, burn rate issues, and unexpected expenditures.""",

        "ai_efficiency": """You are an AI operations analyst evaluating AI usage efficiency.

Analyze the following input related to AI/ML usage.

INPUT:
{content}

METADATA:
{metadata}

Based on this information, provide your assessment in the following format:
SIGNAL_VALUE: [LOW, MODERATE, or HIGH]
CONFIDENCE: [0.0 to 1.0]
EXPLANATION: [2-3 sentence explanation of efficiency factors]

Focus on token utilization, model selection appropriateness, and cost-effectiveness."""
    }
    
    def _determine_applicable_signals(self, metadata: dict) -> List[str]:
        """Determine which signal types apply based on input metadata."""
        content_type = metadata.get("content_type", "")
        
        if content_type in ["risk_register", "status_report"]:
            return ["delivery_risk"]
        elif content_type in ["cost_summary"]:
            return ["cost_risk"]
        elif content_type in ["ai_usage"]:
            return ["ai_efficiency"]
        elif content_type in ["milestones"]:
            return ["delivery_risk"]
        else:
            # For general inputs, assess delivery risk
            return ["delivery_risk"]
    
    def _parse_llm_response(self, response: str) -> Tuple[str, float, str]:
        """Parse LLM response into structured signal data."""
        # Default values
        signal_value = "MEDIUM"
        confidence = 0.5
        explanation = "Unable to parse response."
        
        # Parse signal value
        value_match = re.search(r"SIGNAL_VALUE:\s*(\w+)", response, re.IGNORECASE)
        if value_match:
            signal_value = value_match.group(1).upper()
        
        # Parse confidence
        conf_match = re.search(r"CONFIDENCE:\s*([\d.]+)", response, re.IGNORECASE)
        if conf_match:
            try:
                confidence = float(conf_match.group(1))
                confidence = max(0.0, min(1.0, confidence))  # Clamp to [0, 1]
            except ValueError:
                pass
        
        # Parse explanation - Capture everything after the tag till the end
        exp_match = re.search(r"EXPLANATION:\s*(.*)", response, re.IGNORECASE | re.DOTALL)
        if exp_match:
            explanation = exp_match.group(1).strip()
        
        return signal_value, confidence, explanation
    
    
    def _is_valid_signal(self, value: str, confidence: float, explanation: str, signal_type: str) -> Tuple[bool, str]:
        """Validate the quality and completeness of a generated signal."""
        if "unable to parse" in explanation.lower():
            return False, "Failed to parse LLM response format."
            
        # Check for placeholder/empty explanation
        if not explanation or len(explanation) < 30:
            return False, "Explanation is too short or empty."
            
        # Check for common cut-off patterns
        if explanation.endswith(":") or explanation.endswith("include"):
            return False, "Explanation appears to be truncated."
            
        # Validate value based on type
        valid_values = {
            "delivery_risk": ["LOW", "MEDIUM", "HIGH"],
            "cost_risk": ["NORMAL", "ANOMALOUS"],
            "ai_efficiency": ["LOW", "MODERATE", "HIGH"]
        }
        
        type_values = valid_values.get(signal_type, [])
        if type_values and value not in type_values:
            return False, f"Invalid signal value '{value}' for type '{signal_type}'."
            
        return True, ""

    async def generate_signals(
        self,
        db: Session,
        input_obj: Input
    ) -> List[Signal]:
        """Generate all applicable signals for an input."""
        signals = []
        metadata = input_obj.metadata_json or {}
        
        # Determine which signals to generate
        signal_types = self._determine_applicable_signals(metadata)
        
        for signal_type in signal_types:
            signal = await self._generate_single_signal(db, input_obj, signal_type)
            if signal:
                signals.append(signal)
        
        return signals
    
    async def _generate_single_signal(
        self,
        db: Session,
        input_obj: Input,
        signal_type: str
    ) -> Signal:
        """Generate a single signal of the specified type."""
        # Prepare base content
        base_content = input_obj.normalized_content or input_obj.raw_content
        
        # Try to augment with RAG context
        try:
            from .rag_service import rag_service
            if rag_service.is_available():
                rag_result = rag_service.get_relevant_context(
                    query=base_content[:500],  # Use first 500 chars as query
                    program_id=input_obj.program_id,
                    max_chunks=3,
                    min_relevance=0.25
                )
                if rag_result.get("context"):
                    # Prepend retrieved context
                    base_content = f"[Retrieved Context from Program Documents]\n{rag_result['context']}\n\n[Current Input]\n{base_content}"
        except Exception as e:
            print(f"RAG retrieval failed: {e}")
        
        # Prepare prompt
        prompt_template = self.PROMPTS.get(signal_type, self.PROMPTS["delivery_risk"])
        prompt = prompt_template.format(
            content=base_content,
            metadata=str(input_obj.metadata_json or {})
        )
        
        # Call LLM with retry logic
        max_retries = 2
        retry_count = 0
        current_prompt = prompt
        
        while retry_count <= max_retries:
            response, usage = await llm_client.generate(current_prompt)
            signal_value, confidence, explanation = self._parse_llm_response(response)
            
            # Validate output
            is_valid, error_msg = self._is_valid_signal(signal_value, confidence, explanation, signal_type)
            
            if is_valid:
                break
            
            retry_count += 1
            if retry_count <= max_retries:
                print(f"Signal validation failed (attempt {retry_count}/{max_retries + 1}): {error_msg}")
                # Augment prompt for retry
                current_prompt = f"{prompt}\n\nNOTE: Your previous response was invalid: {error_msg}. Please ensure you follow the structure perfectly and provide a full, detailed explanation."
            else:
                print(f"Signal validation failed after {max_retries} retries. Using best effort.")
        
        # Parse response one last time in case best effort is needed
        # (Already done in the loop)
        
        # Create signal
        signal = Signal(
            input_id=input_obj.id,
            program_id=input_obj.program_id,
            signal_type=signal_type,
            signal_value=signal_value,
            confidence_score=confidence,
            explanation=explanation,
            model_used=usage.get("model_name"),
            status="active"
        )
        db.add(signal)
        db.flush()  # Get signal ID
        
        # Create cost metric
        cost_metric = CostMetric(
            signal_id=signal.id,
            tokens_input=usage.get("tokens_input", 0),
            tokens_output=usage.get("tokens_output", 0),
            tokens_total=usage.get("tokens_total", 0),
            estimated_cost_usd=usage.get("estimated_cost_usd", 0.0),
            model_name=usage.get("model_name", "unknown"),
            latency_ms=usage.get("latency_ms")
        )
        db.add(cost_metric)
        
        return signal


# Singleton instance
signal_generator = SignalGenerator()
