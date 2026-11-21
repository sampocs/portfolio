import datetime
from decimal import Decimal

from backend.config import Config
from backend.scrapers import trades


def _make_order(order_id: str, product_id: str) -> dict:
    return {
        "order_id": order_id,
        "product_id": product_id,
        "side": "BUY",
        "last_fill_time": "2026-11-21T16:29:25.855837Z",
        "average_filled_price": "59938.7",
        "filled_size": "0.08300354",
        "total_fees": "29.85",
        "total_value_after_fees": "5004.99",
        "filled_value": "4975.14",
    }


class _FakeRESTClient:
    def __init__(self, api_key: str, api_secret: str):
        pass

    def list_orders(self, order_status: list[str], start_date: str) -> dict:
        return {
            "orders": [
                _make_order(order_id="usd", product_id="BTC-USD"),
                _make_order(order_id="usdc", product_id="BTC-USDC"),
                _make_order(order_id="btc-quoted", product_id="ETH-BTC"),
                _make_order(order_id="untracked", product_id="DOGE-USD"),
                _make_order(order_id="perp", product_id="BTC-PERP-INTX"),
            ]
        }


def test_coinbase_trades_include_usdc_book_fills(monkeypatch):
    # Coinbase routes some USD buys to the USDC book, which the sync used to drop
    monkeypatch.setattr(trades, "RESTClient", _FakeRESTClient)
    monkeypatch.setattr(Config, "crypto_tokens", ["BTC", "ETH"])

    crypto_trades = trades.get_recent_coinbase_trades(start_date=datetime.date(2026, 11, 1))

    assert [trade.id for trade in crypto_trades] == ["coinbase-usd", "coinbase-usdc"]
    assert {trade.asset for trade in crypto_trades} == {"BTC"}
    assert crypto_trades[1].quantity == Decimal("0.08300354")
    assert crypto_trades[1].cost == Decimal("5004.99")
