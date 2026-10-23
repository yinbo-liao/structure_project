"""AI endpoint and infrastructure regression tests."""


def test_ai_project_summary_does_not_error(client, admin_headers, make_project):
    project = make_project()
    response = client.get(
        f"/api/v1/ai/project-summary/{project['id']}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body.get("summary"), str)
    assert isinstance(body.get("insights"), list)
    assert isinstance(body.get("recommendations"), list)


def test_ai_final_inspection_summary_returns_404_not_500(client, admin_headers):
    response = client.get(
        "/api/v1/ai/inspection-summary/999999",
        headers=admin_headers,
        params={"inspection_type": "final"},
    )
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "Final inspection not found"


def test_ai_inspection_summary_rejects_unknown_type(client, admin_headers):
    response = client.get(
        "/api/v1/ai/inspection-summary/1",
        headers=admin_headers,
        params={"inspection_type": "pipe"},
    )
    assert response.status_code == 400


def test_ai_strategy_capabilities(client, admin_headers):
    response = client.get("/api/v1/ai/strategy/capabilities", headers=admin_headers)
    assert response.status_code == 200, response.text


def test_ai_chat_requires_authentication(client):
    response = client.post("/api/v1/ai/chat", json={"message": "hello"})
    assert response.status_code == 401


def test_ai_chat_rejects_empty_message(client, admin_headers):
    response = client.post("/api/v1/ai/chat", headers=admin_headers, json={"message": ""})
    assert response.status_code == 400


def test_ai_chat_returns_mock_answer_without_api_key(client, admin_headers):
    response = client.post(
        "/api/v1/ai/chat",
        headers=admin_headers,
        json={"message": "Summarize weld quality", "context_data": {"project_summary": {}}},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "Mock Response" in body["message"]["content"]
    assert body["message"]["role"] == "assistant"


def test_metrics_endpoint(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.json()["database"]["type"] == "sqlite"
