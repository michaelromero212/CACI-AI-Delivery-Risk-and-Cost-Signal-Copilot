"""Tests for signal generation logic, specifically parsing and validation."""
import pytest
from app.services.signal_generator import signal_generator

def test_parse_llm_response_standard():
    response = """
    SIGNAL_VALUE: HIGH
    CONFIDENCE: 0.85
    EXPLANATION: This is a test explanation that is long enough to be valid normally.
    """
    val, conf, exp = signal_generator._parse_llm_response(response)
    assert val == "HIGH"
    assert conf == 0.85
    assert exp == "This is a test explanation that is long enough to be valid normally."

def test_parse_llm_response_multiline():
    response = """
    SIGNAL_VALUE: MEDIUM
    CONFIDENCE: 0.7
    EXPLANATION: This explanation spans 
    multiple lines to ensure our regex 
    captures everything until the end.
    """
    val, conf, exp = signal_generator._parse_llm_response(response)
    assert val == "MEDIUM"
    assert conf == 0.7
    assert "multiple lines" in exp
    assert "until the end." in exp

def test_parse_llm_response_lowercase():
    response = """
    signal_value: low
    confidence: 0.5
    explanation: testing lowercase tags.
    """
    val, conf, exp = signal_generator._parse_llm_response(response)
    assert val == "LOW"
    assert conf == 0.5
    assert exp == "testing lowercase tags."

def test_is_valid_signal_valid():
    is_valid, msg = signal_generator._is_valid_signal(
        "HIGH", 0.9, "This is a sufficiently long and professional explanation of program risks.", "delivery_risk"
    )
    assert is_valid is True
    assert msg == ""

def test_is_valid_signal_too_short():
    is_valid, msg = signal_generator._is_valid_signal(
        "HIGH", 0.9, "Too short.", "delivery_risk"
    )
    assert is_valid is False
    assert "too short" in msg.lower()

def test_is_valid_signal_truncated():
    is_valid, msg = signal_generator._is_valid_signal(
        "HIGH", 0.9, "The risks identified in this program include:", "delivery_risk"
    )
    assert is_valid is False
    assert "truncated" in msg.lower()

def test_is_valid_signal_invalid_value():
    is_valid, msg = signal_generator._is_valid_signal(
        "CRITICAL", 0.9, "The explanation itself is fine, but the value is not in our allowed list.", "delivery_risk"
    )
    assert is_valid is False
    assert "invalid signal value" in msg.lower()

def test_is_valid_signal_parse_error():
    is_valid, msg = signal_generator._is_valid_signal(
        "MEDIUM", 0.5, "Unable to parse response.", "delivery_risk"
    )
    assert is_valid is False
    assert "failed to parse" in msg.lower()
