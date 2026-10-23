"""Assistant API: no-key fallback, memory, isolation, tools, and limits."""
import pytest

from app.models import (
    AIMessage,
    StructureFinalInspection,
    User as UserModel,
    WelderRegister,
    WPSRegister,
)
from app.services import assistant_graph, assistant_service
from app.services.ai_memory_service import AIMemoryService
from app.services.assistant_service import AssistantService
from app.services.data_quality_service import clear_scan_cache
from app.services.llm_client import LLMResult, ToolCall
from app.services.rag_service import clear_rag_cache


@pytest.fixture(autouse=True)
def _reset_caches():
    clear_scan_cache()
    clear_rag_cache()
    assistant_service.reset_rate_limits()
    yield
    clear_scan_cache()
    clear_rag_cache()
    assistant_service.reset_rate_limits()


def _seed_project(db, project_id, *, wps_no="WPS-100", welder_no="W-100",
                  final_wps="WPS-1O0", final_welder="W-999", joint_no="J-101"):
    db.add_all([
        WPSRegister(project_id=project_id, wps_no=wps_no),
        WelderRegister(project_id=project_id, welder_no=welder_no),
    ])
    final = StructureFinalInspection(
        project_id=project_id,
        joint_no=joint_no,
        draw_no="D-001",
        structure_category="COL",
        page_no="1",
        block_no="B-1",
        wps_no=final_wps,
        welder_no=final_welder,
    )
    db.add(final)
    db.commit()
    db.refresh(final)
    return final


def _admin(db):
    return db.query(UserModel).filter(UserModel.email == "admin@mpdms.com").first()


def test_chat_without_key_returns_deterministic_findings(
    client, admin_headers, make_project, db_session
):
    project = make_project()
    final = _seed_project(db_session, project["id"])

    response = client.post(
        "/api/v1/ai/assistant/chat",
        headers=admin_headers,
        json={"project_id": project["id"], "message": "Check this project for typos and mismatches"},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["conversation_id"] > 0
    assert body["metrics"]["fallback"] is True
    assert "AI_KEY_NOT_CONFIGURED" in body["warnings"]
    assert body["findings"], "scan intent should produce deterministic findings"
    assert any(item["record_id"] == final.id for item in body["findings"])
    assert "Data-quality scan" in body["message"]["content"]
    assert body["message"]["role"] == "assistant"

    detail = client.get(
        f"/api/v1/ai/conversations/{body['conversation_id']}",
        headers=admin_headers,
        params={"project_id": project["id"]},
    )
    assert detail.status_code == 200, detail.text
    messages = detail.json()["messages"]
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert messages[1]["findings"]


def test_chat_continues_existing_conversation(
    client, admin_headers, make_project, db_session
):
    project = make_project()
    _seed_project(db_session, project["id"])
    first = client.post(
        "/api/v1/ai/assistant/chat",
        headers=admin_headers,
        json={"project_id": project["id"], "message": "Any duplicate piece marks?"},
    )
    assert first.status_code == 200, first.text
    conversation_id = first.json()["conversation_id"]

    second = client.post(
        "/api/v1/ai/assistant/chat",
        headers=admin_headers,
        json={
            "project_id": project["id"],
            "message": "And what about welder numbers?",
            "conversation_id": conversation_id,
        },
    )
    assert second.status_code == 200, second.text
    assert second.json()["conversation_id"] == conversation_id

    detail = client.get(
        f"/api/v1/ai/conversations/{conversation_id}",
        headers=admin_headers,
        params={"project_id": project["id"]},
    )
    assert [message["role"] for message in detail.json()["messages"]] == [
        "user", "assistant", "user", "assistant",
    ]

    listing = client.get(
        "/api/v1/ai/conversations",
        headers=admin_headers,
        params={"project_id": project["id"]},
    )
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["conversations"][0]["id"] == conversation_id


def test_conversation_is_private_to_owner(
    client, admin_headers, make_project, make_user, db_session
):
    project = make_project()
    _seed_project(db_session, project["id"])
    created = client.post(
        "/api/v1/ai/assistant/chat",
        headers=admin_headers,
        json={"project_id": project["id"], "message": "How many joints are there?"},
    )
    assert created.status_code == 200, created.text
    conversation_id = created.json()["conversation_id"]

    user, user_headers = make_user()
    assigned = client.post(
        f"/api/v1/users/{user['id']}/assign-projects",
        headers=admin_headers,
        json={"project_ids": [project["id"]]},
    )
    assert assigned.status_code == 200, assigned.text

    # Project access is not conversation access: another user gets 404.
    detail = client.get(
        f"/api/v1/ai/conversations/{conversation_id}",
        headers=user_headers,
        params={"project_id": project["id"]},
    )
    assert detail.status_code == 404

    continued = client.post(
        "/api/v1/ai/assistant/chat",
        headers=user_headers,
        json={
            "project_id": project["id"],
            "message": "Continue someone else's chat",
            "conversation_id": conversation_id,
        },
    )
    assert continued.status_code == 404

    deleted = client.delete(
        f"/api/v1/ai/conversations/{conversation_id}",
        headers=user_headers,
        params={"project_id": project["id"]},
    )
    assert deleted.status_code == 404


def test_chat_rejects_unassigned_project(client, make_user, make_project):
    project = make_project()
    _, headers = make_user()
    response = client.post(
        "/api/v1/ai/assistant/chat",
        headers=headers,
        json={"project_id": project["id"], "message": "Show everything"},
    )
    assert response.status_code == 403


def test_chat_is_rate_limited(client, admin_headers, make_project, monkeypatch):
    monkeypatch.setattr(assistant_service, "AI_ASSISTANT_RATE_LIMIT", 1)
    assistant_service.reset_rate_limits()
    project = make_project()
    payload = {"project_id": project["id"], "message": "Check for typos"}

    first = client.post("/api/v1/ai/assistant/chat", headers=admin_headers, json=payload)
    assert first.status_code == 200, first.text
    second = client.post("/api/v1/ai/assistant/chat", headers=admin_headers, json=payload)
    assert second.status_code == 429
    assert "Retry-After" in second.headers


def _fake_llm(results):
    class FakeLLM:
        available = True

        def __init__(self):
            self.results = list(results)
            self.calls = 0

        def chat(self, messages, **kwargs):
            self.calls += 1
            return self.results.pop(0)

    return FakeLLM()


def test_tool_loop_executes_and_cites(make_project, db_session):
    project = make_project()
    final = _seed_project(db_session, project["id"])

    fake = _fake_llm([
        LLMResult(
            content="",
            tool_calls=[ToolCall(id="call-1", name="scan_data_quality", arguments={"limit": 5})],
            usage={"total_tokens": 10},
        ),
        LLMResult(
            content=f"Found issues in [final:{final.id}].",
            usage={"total_tokens": 20},
        ),
    ])
    service = AssistantService(db_session, _admin(db_session), project["id"], llm=fake)
    response = service.chat("Scan the welder and WPS values for typos")

    assert fake.calls == 2
    assert response["metrics"]["fallback"] is False
    assert response["metrics"]["iterations"] == 2
    assert response["metrics"]["tokens"] == 30
    assert response["tool_runs"][0]["name"] == "scan_data_quality"
    assert response["tool_runs"][0]["ok"] is True
    assert response["findings"]
    assert [citation["citation_id"] for citation in response["citations"]] == [f"final:{final.id}"]


def test_tool_loop_is_bounded(make_project, db_session, monkeypatch):
    monkeypatch.setattr(assistant_graph, "AI_MAX_TOOL_ROUNDS", 1)
    project = make_project()
    _seed_project(db_session, project["id"])

    def tool_call():
        return LLMResult(
            content="",
            tool_calls=[ToolCall(id="call-x", name="get_project_summary", arguments={})],
            usage={"total_tokens": 5},
        )

    fake = _fake_llm([tool_call(), tool_call(), tool_call()])
    service = AssistantService(db_session, _admin(db_session), project["id"], llm=fake)
    response = service.chat("What is the project progress?")

    assert fake.calls == 2, "one tool round plus the follow-up answer"
    assert len(response["tool_runs"]) == 1
    assert response["metrics"]["iterations"] == 2


def test_unknown_citations_are_dropped(make_project, db_session):
    project = make_project()
    _seed_project(db_session, project["id"])
    fake = _fake_llm([
        LLMResult(content="See [final:999] for details.", usage={"total_tokens": 7}),
    ])
    service = AssistantService(db_session, _admin(db_session), project["id"], llm=fake)
    response = service.chat("What is the status of joint J-101?")

    assert response["citations"] == []
    assert any(warning.startswith("removed_unknown_citations") for warning in response["warnings"])


def test_messages_are_persisted_with_owner_scope(make_project, db_session):
    project = make_project()
    _seed_project(db_session, project["id"])
    fake = _fake_llm([LLMResult(content="No findings.", usage={"total_tokens": 3})])
    service = AssistantService(db_session, _admin(db_session), project["id"], llm=fake)
    response = service.chat("Any problems?")

    stored = (
        db_session.query(AIMessage)
        .filter(AIMessage.conversation_id == response["conversation_id"])
        .order_by(AIMessage.id.asc())
        .all()
    )
    assert [message.role for message in stored] == ["user", "assistant"]
    assert stored[1].tokens == 3

    memory = AIMemoryService(db_session, _admin(db_session), project["id"])
    assert memory.get_conversation(response["conversation_id"]) is not None
