"""Persistent assistant memory and summary policy."""
import pytest

from app.models import User as UserModel
from app.services import ai_memory_service
from app.services.ai_memory_service import AIMemoryService


def _db_user(db, user_payload):
    return db.get(UserModel, user_payload["id"])


def test_conversation_persists_messages(make_user, make_project, db_session):
    user_payload, _ = make_user()
    project = make_project()
    user = _db_user(db_session, user_payload)
    memory = AIMemoryService(db_session, user, project["id"])

    conversation = memory.get_or_create(None, "Check welder numbers for typos")
    memory.add_message(conversation, "user", "Check welder numbers for typos")
    memory.add_message(
        conversation, "assistant", "Found one finding.",
        citations=[{"citation_id": "final:1", "entity": "final_inspection", "record_id": 1, "label": "Final 1"}],
        findings=[{"check": "typo"}],
        tokens=42,
    )

    detail = memory.conversation_detail(conversation)
    assert detail["title"].startswith("Check welder")
    assert [message["role"] for message in detail["messages"]] == ["user", "assistant"]
    assert detail["messages"][1]["citations"][0]["citation_id"] == "final:1"
    assert detail["messages"][1]["tokens"] == 42

    recent = memory.recent_messages(conversation)
    assert [message["role"] for message in recent] == ["user", "assistant"]


def test_conversation_is_isolated_by_user_and_project(make_user, make_project, db_session):
    owner_payload, _ = make_user()
    other_payload, _ = make_user()
    project = make_project()
    other_project = make_project()

    owner = AIMemoryService(db_session, _db_user(db_session, owner_payload), project["id"])
    conversation = owner.create_conversation("private question")

    other_user_same_project = AIMemoryService(
        db_session, _db_user(db_session, other_payload), project["id"]
    )
    assert other_user_same_project.get_conversation(conversation.id) is None

    owner_other_project = AIMemoryService(db_session, _db_user(db_session, owner_payload), other_project["id"])
    assert owner_other_project.get_conversation(conversation.id) is None

    assert owner.get_conversation(conversation.id) is not None


def test_summary_rolls_up_old_messages(make_user, make_project, db_session, monkeypatch):
    monkeypatch.setattr(ai_memory_service, "AI_MEMORY_SUMMARY_THRESHOLD", 3)
    monkeypatch.setattr(ai_memory_service, "AI_MEMORY_MAX_MESSAGES", 2)
    user_payload, _ = make_user()
    project = make_project()
    memory = AIMemoryService(db_session, _db_user(db_session, user_payload), project["id"])
    conversation = memory.create_conversation("summary test")

    for index in range(6):
        memory.add_message(conversation, "user", f"question {index}")
        memory.add_message(conversation, "assistant", f"answer {index}")

    result = memory.maybe_update_summary(conversation, llm=None)
    db_session.refresh(conversation)
    assert result
    assert conversation.summary
    assert conversation.summarized_through_id > 0
    assert "question 0" in conversation.summary

    # A second call with nothing new to summarize is a no-op.
    before = conversation.summary
    assert memory.maybe_update_summary(conversation, llm=None) is None
    assert conversation.summary == before
