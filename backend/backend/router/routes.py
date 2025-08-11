from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import connection, crud
from backend.config import config, VALID_DURATIONS
from backend.router import transforms

router = APIRouter()


def verify_token(request: Request):
    """
    Verify the request has the provided token
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or auth_header != f"Bearer {config.fastapi_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/status")
def health_check():
    return "ok"


@router.get("/portfolio.csv", response_class=PlainTextResponse)
async def get_portfolio_csv(_: HTTPAuthorizationCredentials = Depends(verify_token)):
    return "ticker,quantity,price\nBTC,0.1,30000"


@router.get("/trades")
async def get_trades(_: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)):
    """Returns all trades"""
    return crud.get_all_trades(db)


@router.get("/positions")
async def get_positions(
    _: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)
):
    """Returns all trades"""
    return transforms.get_enriched_positions(db)


@router.get("/allocations")
async def allocations(
    _: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)
):
    """Returns the current and target allocations for each asset"""
    return transforms.get_allocations(db)


@router.get("/performance/{duration}")
async def get_performance(
    duration: str, _: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)
):
    """Returns the historical performance of the portfolio over time"""
    if duration not in VALID_DURATIONS:
        return HTTPException(status_code=400, detail=f"Invalid duration, must be on of: {','.join(VALID_DURATIONS)}")

    return transforms.get_performance(db, duration)
