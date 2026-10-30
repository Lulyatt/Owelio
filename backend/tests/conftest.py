import os

# In-memory SQLite for isolated API tests (before app imports the default file DB).
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient

from owelio.main import app
from owelio.store.instance import reset_app_store


@pytest.fixture()
def client() -> TestClient:
    reset_app_store()
    return TestClient(app)


@pytest.fixture()
def alex_token(client: TestClient) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@example.com", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
