"""LLM Client - Hugging Face Inference API wrapper with cost tracking."""
import time
import httpx
from typing import Optional, Tuple
from ..config import get_settings

settings = get_settings()


class LLMClient:
    """Client for Hugging Face Inference API with token tracking."""
    
    BASE_URL = "https://router.huggingface.co/v1"
    
    def __init__(self):
        self.api_key = settings.huggingface_api_key
        self.model = settings.huggingface_model
        self.cost_per_1k_input = settings.cost_per_1k_input_tokens
        self.cost_per_1k_output = settings.cost_per_1k_output_tokens
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (avg 4 chars per token)."""
        return len(text) // 4
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate estimated cost in USD."""
        input_cost = (input_tokens / 1000) * self.cost_per_1k_input
        output_cost = (output_tokens / 1000) * self.cost_per_1k_output
        return input_cost + output_cost
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 500
    ) -> Tuple[str, dict]:
        """
        Generate text using Hugging Face Inference API.
        
        Returns:
            Tuple of (generated_text, usage_metrics)
        """
        if not self.api_key:
            # Fallback for demo mode without API key
            return self._generate_fallback(prompt)
        
        url = f"{self.BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are an assistant for CACI that analyzes program data for risk, costs, and efficiency signals. Respond in a concise and professional manner."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7
        }
        
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                result = response.json()
        except Exception as e:
            # Fallback on error (could be 401/403 permission error)
            return self._generate_fallback(prompt, str(e))
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Extract generated text from OpenAI format
        if "choices" in result and len(result["choices"]) > 0:
            generated_text = result["choices"][0].get("message", {}).get("content", "")
        else:
            generated_text = str(result)
        
        # Calculate usage metrics
        input_tokens = self._estimate_tokens(prompt)
        output_tokens = self._estimate_tokens(generated_text)
        
        usage = {
            "tokens_input": input_tokens,
            "tokens_output": output_tokens,
            "tokens_total": input_tokens + output_tokens,
            "estimated_cost_usd": self._calculate_cost(input_tokens, output_tokens),
            "model_name": self.model,
            "latency_ms": latency_ms
        }
        
        return generated_text, usage
    
    async def check_connectivity(self) -> dict:
        """
        Check connectivity to Hugging Face API.
        
        Returns:
            dict with 'connected' boolean and 'details' string
        """
        if not self.api_key:
            return {
                "connected": False,
                "status": "configured-demo",
                "details": "No API key configured. Operating in fallback demo mode."
            }
        
        url = f"{self.BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Simple health check using OpenAI format
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    return {
                        "connected": True,
                        "status": "online",
                        "details": f"Connected via HF Router: {self.model}"
                    }
                elif response.status_code == 403 or response.status_code == 401:
                    # Specific permission issue common with new Router
                    return {
                        "connected": False,
                        "status": "auth-error",
                        "details": "Token lacks 'Inference Providers' permission. Please use a Classic token or add 'Inference' scope."
                    }
                elif response.status_code == 503:
                    # Model might be loading
                    return {
                        "connected": False,
                        "status": "loading",
                        "details": "Model is currently loading on Hugging Face servers."
                    }
                else:
                    return {
                        "connected": False,
                        "status": "auth-error" if response.status_code == 401 else "api-error",
                        "details": f"Hugging Face API error: {response.status_code} - {response.text[:100]}"
                    }
        except Exception as e:
            return {
                "connected": False,
                "status": "network-error",
                "details": f"Network error connecting to Hugging Face: {str(e)}"
            }
    
    def _generate_fallback(
        self,
        prompt: str,
        error: Optional[str] = None
    ) -> Tuple[str, dict]:
        """
        Fallback signal generation when API is unavailable.
        Provides deterministic responses based on content keywords.
        """
        prompt_lower = prompt.lower()
        
        # Analyze prompt for risk indicators
        high_risk_keywords = ["delay", "blocked", "critical", "overrun", "missed", "failed", "urgent"]
        medium_risk_keywords = ["concern", "monitor", "watch", "potential", "risk", "variance"]
        
        high_count = sum(1 for kw in high_risk_keywords if kw in prompt_lower)
        medium_count = sum(1 for kw in medium_risk_keywords if kw in prompt_lower)
        
        if "delivery_risk" in prompt_lower or "risk" in prompt_lower:
            if high_count >= 2:
                signal_value = "HIGH"
                confidence = 0.85
                explanation = "Multiple high-risk indicators detected including delays and blockers."
            elif medium_count >= 2 or high_count >= 1:
                signal_value = "MEDIUM"
                confidence = 0.75
                explanation = "Some concerning patterns identified that warrant monitoring."
            else:
                signal_value = "LOW"
                confidence = 0.70
                explanation = "No significant risk indicators detected in the input."
        
        elif "cost" in prompt_lower:
            if "overrun" in prompt_lower or "variance" in prompt_lower and "high" in prompt_lower:
                signal_value = "ANOMALOUS"
                confidence = 0.80
                explanation = "Cost variance detected that exceeds normal thresholds."
            else:
                signal_value = "NORMAL"
                confidence = 0.75
                explanation = "Cost metrics appear within expected ranges."
        
        elif "efficiency" in prompt_lower:
            signal_value = "MODERATE"
            confidence = 0.70
            explanation = "AI usage patterns show moderate efficiency levels."
        
        else:
            signal_value = "MEDIUM"
            confidence = 0.60
            explanation = "Analysis based on available content patterns."
        
        # Add note about fallback mode
        if error:
            explanation += f" [Fallback mode: {error}]"
        else:
            explanation += " [Demo mode: No API key configured]"
        
        # Simulated token usage for fallback
        input_tokens = self._estimate_tokens(prompt)
        output_tokens = self._estimate_tokens(explanation)
        
        usage = {
            "tokens_input": input_tokens,
            "tokens_output": output_tokens,
            "tokens_total": input_tokens + output_tokens,
            "estimated_cost_usd": 0.0,  # No cost in fallback mode
            "model_name": "fallback-rule-based",
            "latency_ms": 50
        }
        
        # Format response to match expected structure
        response = f"""SIGNAL_VALUE: {signal_value}
CONFIDENCE: {confidence}
EXPLANATION: {explanation}"""
        
        return response, usage


# Singleton instance
llm_client = LLMClient()
