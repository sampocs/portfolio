from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import connection, crud
from backend.config import config
from backend.schemas import Position
from backend.scrapers import prices
from backend.jobs import schedules
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Controls the app startup and shutdown with scheduled jobs"""
    scheduler = schedules.get_scheduler()
    scheduler.start()
    yield  # main app flow
    scheduler.shutdown()


app = FastAPI(title="Portfolio Tracker", lifespan=lifespan)


def verify_token(request: Request):
    """
    Verify the request has the provided token
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or auth_header != f"Bearer {config.fastapi_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/status")
def health_check():
    return "ok"


@app.get("/portfolio.csv", response_class=PlainTextResponse)
async def get_portfolio_csv(_: HTTPAuthorizationCredentials = Depends(verify_token)):
    return "ticker,quantity,price\nBTC,0.1,30000"


@app.get("/trades")
async def get_trades(_: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)):
    """Returns all trades"""
    return crud.get_all_trades(db)


@app.get("/positions")
async def get_positions(
    _: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)
):
    """Returns all trades"""
    positions = crud.get_all_positions(db)
    live_prices = prices.get_cached_asset_prices(db)

    enriched_positions = []
    for position in positions:
        current_price = live_prices[position.asset]
        value = current_price * position.quantity
        returns = (value - position.cost) / position.cost * 100

        enriched_positions.append(
            Position(
                asset=position.asset,
                current_price=current_price,
                average_price=position.average_price,
                quantity=position.quantity,
                cost=position.cost,
                value=current_price * position.quantity,
                returns=returns,
            )
        )

    return enriched_positions
