import time
from urllib.parse import parse_qs, urlparse

from backend import alerts


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
    assert not alerts.is_valid_reconnect_signature(expires=int(params["expires"]), signature="deadbeef")


def test_alert_is_skipped_when_unconfigured(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "")

    posted = []
    monkeypatch.setattr(alerts.requests, "post", lambda *args, **kwargs: posted.append(kwargs))

    alerts.send_robinhood_disconnected_alert()
    assert posted == []


def test_alert_posts_to_the_topic(monkeypatch):
    monkeypatch.setattr(alerts.config, "ntfy_topic", "test-topic")
    monkeypatch.setattr(alerts.config, "railway_public_domain", "api.example.com")

    posted = {}
    monkeypatch.setattr(
        alerts.requests, "post", lambda url, **kwargs: posted.update({"url": url, **kwargs})
    )

    alerts.send_robinhood_disconnected_alert()
    assert posted["url"] == "https://ntfy.sh/test-topic"
    assert posted["headers"]["Click"].startswith("https://api.example.com/robinhood/connect?")
