"""Health, authentication, and baseline security-header tests."""


def test_health_reports_healthy(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["services"]["database"]["status"] == "healthy"


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["database"] == "sqlite"


def test_security_headers_present(client):
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "geolocation=()" in response.headers["Permissions-Policy"]


def test_login_success_returns_token(client):
    response = client.post(
        "/api/v1/login", json={"username": "admin@mpdms.com", "password": "admin123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "admin@mpdms.com"


def test_login_wrong_password_rejected(client):
    response = client.post(
        "/api/v1/login", json={"username": "admin@mpdms.com", "password": "wrong"}
    )
    assert response.status_code == 401


def test_login_unknown_user_rejected(client):
    response = client.post(
        "/api/v1/login", json={"username": "nobody@example.test", "password": "whatever"}
    )
    assert response.status_code == 401


def test_login_rate_limited_after_repeated_failures(client):
    for _ in range(5):
        client.post(
            "/api/v1/login",
            json={"username": "admin@mpdms.com", "password": "wrong"},
        )
    response = client.post(
        "/api/v1/login", json={"username": "admin@mpdms.com", "password": "admin123"}
    )
    assert response.status_code == 429


def test_me_requires_authentication(client):
    assert client.get("/api/v1/users/me").status_code == 401


def test_me_returns_current_user(client, admin_headers):
    response = client.get("/api/v1/users/me", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "admin@mpdms.com"
    assert response.json()["role"] == "admin"


def test_inactive_user_token_is_rejected(client, admin_headers, make_user):
    user, headers = make_user()
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200

    deactivate = client.put(
        f"/api/v1/users/{user['id']}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deactivate.status_code == 200

    assert client.get("/api/v1/users/me", headers=headers).status_code == 401


def test_database_info_requires_admin(client, admin_headers, make_user):
    _, visitor_headers = make_user(role="visitor")
    assert client.get("/database/info", headers=visitor_headers).status_code == 403
    assert client.get("/database/info", headers=admin_headers).status_code == 200
