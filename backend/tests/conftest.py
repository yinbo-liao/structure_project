"""Shared pytest fixtures.

Environment variables are set before importing the application so that
``app.database`` binds to a disposable SQLite file instead of the developer's
working database.
"""
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

_TMP_DIR = Path(tempfile.mkdtemp(prefix="mpdms-tests-"))
_SQLITE_PATH = (_TMP_DIR / "test.db").as_posix()

os.environ.update(
    {
        "DB_TYPE": "sqlite",
        "SQLITE_PATH": _SQLITE_PATH,
        "TESTING": "false",
        "ENVIRONMENT": "development",
        "SECRET_KEY": "test-secret-key-not-for-production",
        "ALLOWED_HOSTS": "testserver,localhost,127.0.0.1",
        "DEFAULT_ADMIN_PASSWORD": "admin123",
        "TEST_LOGIN_BYPASS": "false",
        "REDIS_URL": "redis://127.0.0.1:6399/0",
        "DEEPSEEK_API_KEY": "",
        "AI_API_KEY": "",
    }
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.routes import auth as auth_routes  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Direct session for seeding records that the API cannot easily create."""
    from app.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def reset_login_rate_limiter():
    """Each test starts with a clean per-IP login attempt window."""
    auth_routes._login_attempts.clear()
    yield


@pytest.fixture(scope="session")
def admin_token(client):
    response = client.post(
        "/api/v1/login",
        json={"username": "admin@mpdms.com", "password": "admin123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def login(client, email, password):
    response = client.post(
        "/api/v1/login", json={"username": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_user(client, admin_headers):
    """Create a user and return (user_dict, headers)."""

    def _make(role="inspector", password="Passw0rd!", is_active=True):
        email = f"{role}-{uuid.uuid4().hex[:8]}@example.test"
        response = client.post(
            "/api/v1/users",
            headers=admin_headers,
            json={
                "email": email,
                "password": password,
                "full_name": f"Test {role}",
                "role": role,
            },
        )
        assert response.status_code == 200, response.text
        user = response.json()
        if not is_active:
            update = client.put(
                f"/api/v1/users/{user['id']}",
                headers=admin_headers,
                json={"is_active": False},
            )
            assert update.status_code == 200, update.text
        token = login(client, email, password)
        return user, auth_headers(token)

    return _make


@pytest.fixture
def make_project(client, admin_headers):
    def _make(name=None):
        suffix = uuid.uuid4().hex[:8]
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"name": name or f"Project {suffix}", "code": f"TEST-{suffix}"},
        )
        assert response.status_code == 200, response.text
        return response.json()

    return _make
