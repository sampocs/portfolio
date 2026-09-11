import hashlib
import hmac
import time

import requests

from backend.config import config, logger

NTFY_URL = "https://ntfy.sh/{}"
RECONNECT_PATH = "/robinhood/connect"
RECONNECT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60
SIGNATURE_MESSAGE = "robinhood-connect:{}"
REQUEST_TIMEOUT_SECONDS = 10


def build_reconnect_link() -> str:
    """Builds a signed, expiring link to the reconnect endpoint"""
    expires = int(time.time()) + RECONNECT_LINK_TTL_SECONDS
    signature = _sign_reconnect_link(expires)
    return f"https://{config.railway_public_domain}{RECONNECT_PATH}?expires={expires}&signature={signature}"


def is_valid_reconnect_signature(expires: int, signature: str) -> bool:
    """Returns whether the link is correctly signed and hasn't expired"""
    if expires < int(time.time()):
        return False

    return hmac.compare_digest(_sign_reconnect_link(expires), signature)


def send_robinhood_disconnected_alert() -> None:
    """
    Pushes a notification with a one-tap reconnect link

    A disabled SnapTrade connection keeps serving stale cached data rather than failing,
    so without this alert a broken connection would go unnoticed
    """
    if not config.ntfy_topic or not config.railway_public_domain:
        logger.warning(
            "Alerts are not configured, skipping the robinhood disconnect notification"
        )
        return

    requests.post(
        NTFY_URL.format(config.ntfy_topic),
        data="Tap to log back in to Robinhood",
        headers={
            "Title": "Robinhood disconnected",
            "Click": build_reconnect_link(),
            "Tags": "warning",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def _sign_reconnect_link(expires: int) -> str:
    """
    Signs the link with the API secret

    The link is opened from a notification, which can't send the API's bearer header.
    Without a signature, anyone holding the URL could attach their own brokerage
    account to this SnapTrade user and have their trades synced here
    """
    message = SIGNATURE_MESSAGE.format(expires).encode()
    return hmac.new(config.fastapi_secret.encode(), message, hashlib.sha256).hexdigest()
