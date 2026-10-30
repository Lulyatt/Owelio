from fastapi.testclient import TestClient

from tests.conftest import auth_headers


def test_seeded_groups_for_alex(client: TestClient, alex_token: str) -> None:
    res = client.get("/api/v1/groups", headers=auth_headers(alex_token))
    assert res.status_code == 200
    names = {g["name"] for g in res.json()}
    assert names == {"Lisbon weekend", "Flat 4B"}


def test_seeded_expenses(client: TestClient, alex_token: str) -> None:
    res = client.get("/api/v1/groups/g_lisbon/expenses", headers=auth_headers(alex_token))
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_non_member_forbidden(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={"name": "Eve", "email": "eve@example.com", "password": "password123"},
    )
    token = reg.json()["access_token"]
    res = client.get("/api/v1/groups/g_lisbon/expenses", headers=auth_headers(token))
    assert res.status_code == 403


def test_join_by_code(client: TestClient) -> None:
    sam = client.post(
        "/api/v1/auth/login",
        json={"email": "sam@example.com", "password": "password123"},
    )
    sam_token = sam.json()["access_token"]
    reg = client.post(
        "/api/v1/auth/register",
        json={"name": "Pat", "email": "pat@example.com", "password": "password123"},
    )
    pat_token = reg.json()["access_token"]
    joined = client.post(
        "/api/v1/groups/join",
        json={"code": "FLAT4B"},
        headers=auth_headers(pat_token),
    )
    assert joined.status_code == 200
    assert "pat@example.com" in {m["email"] for m in client.get(
        "/api/v1/groups/g_flat/members",
        headers=auth_headers(sam_token),
    ).json()}


def test_dashboard_summary(client: TestClient, alex_token: str) -> None:
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers(alex_token))
    assert res.status_code == 200
    body = res.json()
    assert "youOwe" in body
    assert len(body["groups"]) == 2


def test_create_expense_invalid_split(client: TestClient, alex_token: str) -> None:
    payload = {
        "description": "Bad",
        "amount": 1000,
        "currency": "GBP",
        "exchangeRate": 1,
        "date": "2026-10-01",
        "category": "Other",
        "attachments": [],
        "paidBy": "u_alex",
        "participantIds": ["u_alex"],
        "split": {"method": "custom", "amounts": {"u_alex": 1}},
    }
    res = client.post(
        "/api/v1/groups/g_flat/expenses",
        json=payload,
        headers=auth_headers(alex_token),
    )
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "invalid"
