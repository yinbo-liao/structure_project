"""Synchronous OpenAI-compatible chat client used by the assistant graph."""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def api_key() -> str:
    return (os.getenv("DEEPSEEK_API_KEY") or os.getenv("AI_API_KEY") or "").strip()


def api_url() -> str:
    return os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")


def model_name() -> str:
    return os.getenv("DEEPSEEK_MODEL", "deepseek-flash")


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any] = field(default_factory=dict)
    raw_arguments: str = ""
    parse_error: Optional[str] = None


@dataclass
class LLMResult:
    content: str = ""
    tool_calls: List[ToolCall] = field(default_factory=list)
    usage: Dict[str, int] = field(default_factory=dict)
    model: str = ""
    tools_unsupported: bool = False


class LLMError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        retryable: bool = False,
        status_code: Optional[int] = None,
        tools_unsupported: bool = False,
    ):
        super().__init__(message)
        self.retryable = retryable
        self.status_code = status_code
        self.tools_unsupported = tools_unsupported


class LLMClient:
    """Chat completions with bounded retries, tools, and usage reporting.

    Configuration is read at call time so tests and the eval script can change
    environment variables without re-importing the application.
    """

    def __init__(self, timeout: Optional[float] = None, max_retries: Optional[int] = None):
        self.timeout = timeout if timeout is not None else float(os.getenv("AI_TIMEOUT_SECONDS", "30"))
        self.max_retries = max_retries if max_retries is not None else max(1, _env_int("AI_MAX_RETRIES", 3))

    @property
    def available(self) -> bool:
        return bool(api_key())

    def chat(
        self,
        messages: List[Dict[str, Any]],
        *,
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> LLMResult:
        key = api_key()
        if not key:
            raise LLMError("AI key is not configured", retryable=False)
        url = api_url()
        model = model_name()
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(url, headers=headers, json=payload)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                if attempt + 1 < self.max_retries:
                    time.sleep(min(2 ** attempt, 4))
                continue

            if response.status_code == 200:
                return self._parse_response(response, model)

            body = response.text or ""
            if response.status_code in (400, 422) and tools:
                lowered = body.lower()
                if "tool" in lowered or "function" in lowered or "unsupported" in lowered:
                    raise LLMError(
                        "AI gateway does not support tool calling",
                        status_code=response.status_code,
                        tools_unsupported=True,
                    )
            if response.status_code in (429, 500, 502, 503, 504):
                last_error = LLMError(
                    f"AI upstream returned HTTP {response.status_code}",
                    retryable=True,
                    status_code=response.status_code,
                )
                if attempt + 1 < self.max_retries:
                    time.sleep(min(2 ** attempt, 4))
                continue
            raise LLMError(
                "AI upstream rejected the request",
                status_code=response.status_code,
            )

        logger.warning("AI request failed after %s attempts: %s", self.max_retries, last_error)
        raise LLMError("AI service temporarily unavailable", retryable=True) from last_error

    @staticmethod
    def _parse_response(response: httpx.Response, model: str) -> LLMResult:
        try:
            data = response.json()
            message = data["choices"][0]["message"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError("AI upstream returned an unreadable response") from exc

        tool_calls: List[ToolCall] = []
        for index, item in enumerate(message.get("tool_calls") or []):
            function = item.get("function") or {}
            raw_arguments = function.get("arguments") or "{}"
            parse_error = None
            try:
                arguments = json.loads(raw_arguments) if isinstance(raw_arguments, str) else dict(raw_arguments)
                if not isinstance(arguments, dict):
                    raise ValueError("tool arguments must be an object")
            except (ValueError, TypeError) as exc:
                arguments = {}
                parse_error = str(exc)
            tool_calls.append(ToolCall(
                id=item.get("id") or f"call_{index}",
                name=function.get("name") or "",
                arguments=arguments,
                raw_arguments=raw_arguments if isinstance(raw_arguments, str) else "",
                parse_error=parse_error,
            ))

        usage = data.get("usage") or {}
        return LLMResult(
            content=(message.get("content") or "").strip(),
            tool_calls=tool_calls,
            usage={
                "prompt_tokens": int(usage.get("prompt_tokens") or 0),
                "completion_tokens": int(usage.get("completion_tokens") or 0),
                "total_tokens": int(usage.get("total_tokens") or 0),
            },
            model=data.get("model") or model,
        )
