from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_root() -> None:
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert response.json() == "Hello, world!"


def test_demotest() -> None:
    with TestClient(app) as client:
        response = client.get("/demotest")
    assert response.status_code == 200
    assert response.json() == "this is a test"
