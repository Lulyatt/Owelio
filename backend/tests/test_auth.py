from fastapi.testclient import TestClient

from tests.conftest import auth_headers


def test_me_without_token(client: TestClient) -> None:
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 200
    assert res.json() == {"user": None}


def test_login_seeded_user(client: TestClient) -> None:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@example.com", "password": "password123"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "alex@example.com"
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password(client: TestClient) -> None:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@example.com", "password": "wrong"},
    )
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "unauthenticated"


def test_register_and_me(client: TestClient) -> None:
    res = client.post(
        "/api/v1/auth/register",
        json={"name": "New User", "email": "new@example.com", "password": "password123"},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.json()["user"]["email"] == "new@example.com"


def test_protected_route_requires_auth(client: TestClient) -> None:
    res = client.get("/api/v1/groups")
    assert res.status_code == 401


def test_logout(client: TestClient, alex_token: str) -> None:
    res = client.post("/api/v1/auth/logout", headers=auth_headers(alex_token))
    assert res.status_code == 204
    groups = client.get("/api/v1/groups", headers=auth_headers(alex_token))
    assert groups.status_code == 401
