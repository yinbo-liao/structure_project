"""Multi-tenant authorization and project-isolation regression tests."""

import pytest


def _assign(client, admin_headers, user_id, project_ids):
    response = client.post(
        f"/api/v1/users/{user_id}/assign-projects",
        headers=admin_headers,
        json={"project_ids": project_ids},
    )
    assert response.status_code == 200, response.text


def _material_payload(project_id, piece_mark="PM-1"):
    return {
        "project_id": project_id,
        "piece_mark_no": piece_mark,
        "material_type": "plate",
        "grade": "A36",
        "thickness": "10",
    }


@pytest.fixture
def two_projects(make_project):
    return make_project("Project A"), make_project("Project B")


@pytest.fixture
def scoped_inspector(client, admin_headers, make_user, two_projects):
    project_a, project_b = two_projects
    user, headers = make_user(role="inspector")
    _assign(client, admin_headers, user["id"], [project_a["id"]])
    return user, headers, project_a, project_b


def test_inspector_cannot_read_other_project_summary(client, scoped_inspector):
    _, headers, project_a, project_b = scoped_inspector
    assert (
        client.get(f"/api/v1/projects/{project_a['id']}/summary", headers=headers).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/projects/{project_b['id']}/summary", headers=headers).status_code
        == 403
    )


def test_inspector_cannot_list_other_project_materials(client, scoped_inspector):
    _, headers, project_a, project_b = scoped_inspector
    assert (
        client.get(
            "/api/v1/structure/material-register",
            headers=headers,
            params={"project_id": project_a["id"]},
        ).status_code
        == 200
    )
    assert (
        client.get(
            "/api/v1/structure/material-register",
            headers=headers,
            params={"project_id": project_b["id"]},
        ).status_code
        == 403
    )


def test_inspector_cannot_write_to_unassigned_project(client, scoped_inspector):
    _, headers, project_a, project_b = scoped_inspector

    denied = client.post(
        "/api/v1/structure/material-register",
        headers=headers,
        json=_material_payload(project_b["id"], "PM-DENIED"),
    )
    assert denied.status_code == 403

    allowed = client.post(
        "/api/v1/structure/material-register",
        headers=headers,
        json=_material_payload(project_a["id"], "PM-ALLOWED"),
    )
    assert allowed.status_code == 200, allowed.text


def test_visitor_cannot_write(client, make_user, two_projects):
    project_a, _ = two_projects
    _, headers = make_user(role="visitor")
    response = client.post(
        "/api/v1/structure/material-register",
        headers=headers,
        json=_material_payload(project_a["id"], "PM-VISITOR"),
    )
    assert response.status_code == 403


def test_ndt_sync_requires_project_assignment(client, scoped_inspector):
    _, headers, project_a, project_b = scoped_inspector

    assert (
        client.get(f"/api/v1/ndt-sync/status/{project_a['id']}", headers=headers).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/ndt-sync/status/{project_b['id']}", headers=headers).status_code
        == 403
    )
    assert (
        client.post(f"/api/v1/ndt-sync/sync/project/{project_b['id']}", headers=headers).status_code
        == 403
    )


def test_global_ndt_sync_status_is_admin_only(client, admin_headers, scoped_inspector):
    _, headers, _, _ = scoped_inspector
    assert client.get("/api/v1/ndt-sync/status", headers=headers).status_code == 403
    assert client.get("/api/v1/ndt-sync/status", headers=admin_headers).status_code == 200


def test_ndt_request_cannot_link_final_from_another_project(
    client, admin_headers, make_user, two_projects
):
    project_a, project_b = two_projects
    user, headers = make_user(role="inspector")
    _assign(client, admin_headers, user["id"], [project_a["id"], project_b["id"]])

    final = client.post(
        "/api/v1/structure/final-inspection",
        headers=headers,
        json={
            "project_id": project_a["id"],
            "joint_no": "J-100",
            "final_result": "Accepted",
            "final_report_no": "FR-100",
        },
    )
    assert final.status_code == 200, final.text

    response = client.post(
        "/api/v1/structure/ndt-requests",
        headers=headers,
        json={"project_id": project_b["id"], "final_id": final.json()["id"]},
    )
    assert response.status_code == 400
    assert "same project" in response.json()["detail"].lower()


def test_duplicate_bulk_update_route_is_removed():
    from app.main import app

    matches = [
        route
        for route in app.routes
        if getattr(route, "path", None) == "/api/v1/structure/final-inspection/bulk-update"
        and "PUT" in getattr(route, "methods", set())
    ]
    assert len(matches) == 1
