"""Request-scoped orchestration for the LangGraph assistant.

The route is synchronous; FastAPI runs it in the threadpool so the sync
SQLAlchemy session and ``httpx.Client`` are never used from the event loop.
"""
from __future__ import annotations

import os
import threading
import time
from collections import deque
from typing import Deque, Dict, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User as UserModel
from app.services.ai_context import AI_MAX_MESSAGE_CHARS, sanitize_text
from app.services.ai_memory_service import AIMemoryService
from app.services.assistant_graph import build_assistant_graph
from app.services.llm_client import LLMClient, LLMError

AI_ASSISTANT_RATE_LIMIT = max(1, int(os.getenv("AI_ASSISTANT_RATE_LIMIT", "20")))
AI_RATE_WINDOW_SECONDS = float(os.getenv("AI_RATE_WINDOW_SECONDS", "60"))

_RATE_LOCK = threading.Lock()
_RATE_BUCKETS: Dict[int, Deque[float]] = {}


def reset_rate_limits() -> None:
    """Test hook: clear the per-user assistant request window."""
    with _RATE_LOCK:
        _RATE_BUCKETS.clear()


def _enforce_rate_limit(user_id: int) -> None:
    now = time.monotonic()
    with _RATE_LOCK:
        bucket = _RATE_BUCKETS.setdefault(user_id, deque())
        while bucket and now - bucket[0] > AI_RATE_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= AI_ASSISTANT_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Too many assistant requests. Please wait a minute and try again.",
                headers={"Retry-After": str(int(AI_RATE_WINDOW_SECONDS))},
            )
        bucket.append(now)


class AssistantService:
    def __init__(
        self,
        db: Session,
        user: UserModel,
        project_id: int,
        llm: Optional[LLMClient] = None,
    ):
        self.db = db
        self.user = user
        self.project_id = project_id
        self.llm = llm or LLMClient()

    def chat(self, message: str, conversation_id: Optional[int] = None) -> Dict:
        query = sanitize_text(message, AI_MAX_MESSAGE_CHARS)
        if not query:
            raise HTTPException(status_code=422, detail="Message must not be empty")

        _enforce_rate_limit(self.user.id)
        memory = AIMemoryService(self.db, self.user, self.project_id)

        if conversation_id is None:
            conversation = memory.create_conversation(query)
        else:
            conversation = memory.get_conversation(conversation_id)
            if conversation is None:
                raise HTTPException(status_code=404, detail="Conversation not found")

        recent = memory.recent_messages(conversation)
        state = {
            "query": query,
            "project_id": self.project_id,
            "user_id": self.user.id,
            "conversation_id": conversation.id,
            "summary": conversation.summary or "",
            "recent_messages": recent,
            "docs": [],
            "extra_docs": [],
            "findings": [],
            "project_metrics": None,
            "tool_results": [],
            "tool_runs": [],
            "llm_history": [],
            "pending_tool_calls": [],
            "tool_rounds": 0,
            "answer": "",
            "citations": [],
            "verified": True,
            "warnings": [],
            "fallback": False,
            "degraded": False,
            "iterations": 0,
            "tokens": 0,
            "response": {},
        }

        graph = build_assistant_graph(self.db, self.user, self.project_id, self.llm)
        try:
            final_state = graph.invoke(state, config={"recursion_limit": 25})
        except LLMError:
            raise HTTPException(status_code=502, detail="AI service temporarily unavailable")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Assistant failed to answer")

        response = final_state.get("response") or {}
        if not response:
            raise HTTPException(status_code=500, detail="Assistant failed to answer")

        memory.add_message(conversation, "user", query)
        memory.add_message(
            conversation,
            "assistant",
            response["message"]["content"],
            citations=response.get("citations", []),
            findings=response.get("findings", []),
            tool_runs=response.get("tool_runs", []),
            tokens=response.get("metrics", {}).get("tokens", 0),
        )
        try:
            memory.maybe_update_summary(conversation, self.llm)
        except Exception:
            # Summary maintenance is best effort and must never fail the answer.
            self.db.rollback()

        return response
