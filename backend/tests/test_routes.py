import urllib.parse

import fastapi
import pytest
from fastapi.testclient import TestClient

from backend import alerts
from backend.router import routes


@pytest.fixture
def client() -> TestClient:
    """Serves the router on its own, so the app's scheduler never starts"""
    app = fastapi.FastAPI()
    app.include_router(routes.router)
    return TestClient(app)


def _signed_link_params() -> dict[str, str]:
    query = urllib.parse.urlparse(alerts.build_reconnect_link()).query
    return {key: values[0] for key, values in urllib.parse.parse_qs(query).items()}


def test_reconnect_refuses_to_mint_a_fresh_connect_portal(client, monkeypatch):
    monkeypatch.setattr(routes.robinhood, "get_client", lambda: "client")
    monkeypatch.setattr(routes.robinhood, "get_connection", lambda client: None)

    response = client.get(alerts.RECONNECT_PATH, params=_signed_link_params())

    assert response.status_code == 409
    assert "make robinhood-connect" in response.json()["detail"]


def test_reconnect_rejects_an_unsigned_link(client):
    response = client.get(
        alerts.RECONNECT_PATH, params={"expires": 9999999999, "signature": "deadbeef"}
    )

    assert response.status_code == 403
