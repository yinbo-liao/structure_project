"""AI assistant endpoints: deterministic data quality, chat, and memory."""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import ensure_project_access, get_current_user
from app.database import get_db
from app.models import Project as ProjectModel, User as UserModel
from app.schemas import (
    AIAssistantRequest,
    AIAssistantResponse,
    AIConversationDetail,
    AIConversationListResponse,
)
from app.services.ai_memory_service import AIMemoryService
from app.services.assistant_service import AssistantService
from app.services.data_quality_service import scan_project_cached

router = APIRouter()

_VALID_SEVERITIES = {"high", "medium", "low"}


def _require_project(db: Session, current_user: UserModel, project_id: int) -> ProjectModel:
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_project_access(db, current_user, project_id)
    return project


@router.get("/ai/data-quality/{project_id}")
def get_project_data_quality(
    project_id: int,
    severity: Optional[str] = Query(None, pattern="^(high|medium|low)$"),
    entity: Optional[str] = Query(None, max_length=64),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Read-only identifier checks for welder, WPS, joint, drawing, and NDT records.

    Findings are advisory only; this endpoint never modifies QA data and does
    not require an LLM key.
    """
    _require_project(db, current_user, project_id)
    result = scan_project_cached(db, project_id)

    findings = result["findings"]
    if severity:
        findings = [item for item in findings if item["severity"] == severity]
    if entity:
        findings = [item for item in findings if item["entity"] == entity]

    total = len(findings)
    page = findings[offset:offset + limit]
    return {
        **{key: value for key, value in result.items() if key != "findings"},
        "total_findings": total,
        "returned": len(page),
        "limit": limit,
        "offset": offset,
        "findings": page,
    }


@router.post("/ai/assistant/chat", response_model=AIAssistantResponse)
def assistant_chat(
    payload: AIAssistantRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Ask the project QA assistant.

    Only retrieved snippets and bounded tool results leave the server. The
    assistant is read-only: no QA record is ever modified.
    """
    if os.getenv("AI_ASSISTANT_ENABLED", "true").strip().lower() in {"0", "false", "no"}:
        raise HTTPException(status_code=503, detail="AI assistant is disabled")
    _require_project(db, current_user, payload.project_id)
    service = AssistantService(db, current_user, payload.project_id)
    return service.chat(payload.message, payload.conversation_id)


@router.get("/ai/conversations", response_model=AIConversationListResponse)
def list_conversations(
    project_id: int = Query(..., ge=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """List the caller's conversations for one accessible project."""
    _require_project(db, current_user, project_id)
    memory = AIMemoryService(db, current_user, project_id)
    conversations = memory.list_conversations(limit=limit, offset=offset)
    return {
        "conversations": [memory.serialize_conversation(item) for item in conversations],
        "total": memory.count_conversations(),
    }


@router.get("/ai/conversations/{conversation_id}", response_model=AIConversationDetail)
def get_conversation(
    conversation_id: int,
    project_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Return one conversation owned by the caller for an accessible project."""
    _require_project(db, current_user, project_id)
    memory = AIMemoryService(db, current_user, project_id)
    conversation = memory.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return memory.conversation_detail(conversation)


@router.delete("/ai/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    project_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Delete one conversation owned by the caller. Messages cascade."""
    _require_project(db, current_user, project_id)
    memory = AIMemoryService(db, current_user, project_id)
    if not memory.delete_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "conversation_id": conversation_id}
