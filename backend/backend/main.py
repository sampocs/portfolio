from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import connection, crud
from backend.scrapers import ibkr
from backend.config import config

app = FastAPI(title="Portfolio Tracker")


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
    return ibkr.get_current_holdings()
