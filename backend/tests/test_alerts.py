import time
from urllib.parse import parse_qs, urlparse

import requests

from backend import alerts


class _FakeResponse:
    """Minimal stand-in for requests.Response used to drive raise_for_status()"""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f"{self.status_code} error")


def _parse_link(link: str) -> dict[str, str]:
    query = parse_qs(urlparse(link).query)
    return {key: values[0] for key, values in query.items()}


def test_generated_link_is_valid():
    params = _parse_link(alerts.build_reconnect_link())
    assert alerts.is_valid_reconnect_signature(
        expires=int(params["expires"]), signature=params["signature"]
    )


def test_expired_link_is_rejected():
    expires = int(time.time()) - 1
    signature = alerts._sign_reconnect_link(expires)
    assert not alerts.is_valid_reconnect_signature(expires=expires, signature=signature)


def test_tampered_expiry_is_rejected():
    params = _parse_link(alerts.build_reconnect_link())
    extended_expiry = int(params["expires"]) + 1000
    assert not alerts.is_valid_reconnect_signature(
        expires=extended_expiry, signature=params["signature"]
    )


def test_tampered_signature_is_rejected():
    params = _parse_link(alerts.build_reconnect_link())
    assert not alerts.is_valid_reconnect_signature(
        expires=int(params["expires"]), signature="deadbeef"
    )


def test_alert_is_skipped_when_unconfigured(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "")

    posted = []
    monkeypatch.setattr(
        alerts.requests, "post", lambda *args, **kwargs: posted.append(kwargs)
    )

    alerts.send_robinhood_disconnected_alert()
    assert posted == []


def test_alert_posts_to_the_topic(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "test-topic")
    monkeypatch.setattr(alerts.config, "railway_public_domain", "api.example.com")

    posted = {}

    def fake_post(url: str, **kwargs) -> _FakeResponse:
        posted.update({"url": url, **kwargs})
        return _FakeResponse(status_code=200)

    monkeypatch.setattr(alerts.requests, "post", fake_post)

    alerts.send_robinhood_disconnected_alert()
    assert posted["url"] == "https://ntfy.sh/test-topic"
    assert posted["headers"]["Click"].startswith(
        "https://api.example.com/robinhood/connect?"
    )


def test_alert_logs_warning_on_non_2xx_response(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "test-topic")
    monkeypatch.setattr(alerts.config, "railway_public_domain", "api.example.com")
    monkeypatch.setattr(
        alerts.requests, "post", lambda url, **kwargs: _FakeResponse(status_code=500)
    )

    warnings = []
    monkeypatch.setattr(
        alerts.logger, "warning", lambda message: warnings.append(message)
    )

    alerts.send_robinhood_disconnected_alert()
    assert len(warnings) == 1
    assert "500" in warnings[0]


def test_alert_logs_warning_on_request_exception(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "test-topic")
    monkeypatch.setattr(alerts.config, "railway_public_domain", "api.example.com")

    def fake_post(url: str, **kwargs):
        raise requests.exceptions.ConnectionError("connection refused")

    monkeypatch.setattr(alerts.requests, "post", fake_post)

    warnings = []
    monkeypatch.setattr(
        alerts.logger, "warning", lambda message: warnings.append(message)
    )

    alerts.send_robinhood_disconnected_alert()
    assert len(warnings) == 1
    assert "connection refused" in warnings[0]
