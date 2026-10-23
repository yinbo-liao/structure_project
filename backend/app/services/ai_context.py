"""Shared AI input guards and context formatting.

These helpers are used by the legacy AI routes and the assistant services so
that size limits and untrusted-data handling stay consistent.
"""
import os
import re

AI_MAX_MESSAGE_CHARS = int(os.getenv("AI_MAX_MESSAGE_CHARS", "4000"))
AI_MAX_MESSAGES = int(os.getenv("AI_MAX_MESSAGES", "20"))
AI_MAX_CONTEXT_CHARS = int(os.getenv("AI_MAX_CONTEXT_CHARS", "12000"))

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_text(value: str, max_chars: int = AI_MAX_MESSAGE_CHARS) -> str:
    """Strip control characters and cap length before sending text to an LLM."""
    if not isinstance(value, str):
        value = str(value)
    cleaned = _CONTROL_CHARS.sub("", value).strip()
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars] + "...[truncated]"
    return cleaned


def format_context_data(context_data: dict) -> str:
    """Format context data for AI consumption (bounded, no recursive expansion)."""
    formatted = ""
    for key, value in context_data.items():
        if isinstance(value, dict):
            formatted += f"{key}:\n"
            for sub_key, sub_value in value.items():
                formatted += f"  - {sub_key}: {sub_value}\n"
        elif isinstance(value, list):
            formatted += f"{key}: {len(value)} items\n"
            for item in value[:5]:
                formatted += f"  - {item}\n"
        else:
            formatted += f"{key}: {value}\n"
    return formatted
