import datetime
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from fastapi import Query
from sqlalchemy.orm import Session
from backend.database import connection, crud
from backend.config import config, VALID_DURATIONS
from backend.router import transforms
from backend.jobs import jobs

router = APIRouter()

_last_indexed_trades = datetime.datetime.now() - datetime.timedelta(minutes=config.trades_cache_ttl_min)


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


@router.get("/authenticate")
def authenticate(_: HTTPAuthorizationCredentials = Depends(verify_token)):
    return "ok"


@router.get("/trades")
async def get_trades(_: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)):
    """Returns all trades"""
    return crud.get_trades(db)


@router.get("/trades/{asset}")
async def get_trades_by_asset(
    asset: str,
    _: HTTPAuthorizationCredentials = Depends(verify_token),
    db: Session = Depends(connection.get_db),
):
    """Returns all trades for the given asset"""
    if asset not in config.assets.keys():
        return HTTPException(status_code=400, detail=f"Invalid asset, must be one of {','.join(config.assets.keys())}")

    return crud.get_trades(db, asset=asset)


@router.get("/positions")
async def get_positions(
    _: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)
):
    """Returns all trades"""
    return transforms.get_enriched_positions(db)


@router.get("/performance/{duration}")
async def get_performance(
    duration: str,
    assets: str | None = Query(None, description="Comma-separated list of asset symbols"),
    _: HTTPAuthorizationCredentials = Depends(verify_token),
    db: Session = Depends(connection.get_db),
):
    """Returns the historical performance of the portfolio over time"""
    if duration not in VALID_DURATIONS:
        return HTTPException(status_code=400, detail=f"Invalid duration, must be on of: {','.join(VALID_DURATIONS)}")

    asset_list = [asset.strip().upper() for asset in assets.split(",") if asset.strip()] if assets else []

    invalid_assets = [asset for asset in asset_list if asset not in config.assets.keys()]
    if invalid_assets:
        return HTTPException(
            status_code=400, detail=f"Invalid asset(s), must be one of {','.join(config.assets.keys())}"
        )

    return transforms.get_performance(db, duration=duration, assets=asset_list)


@router.get("/prices/{asset}")
async def get_prices_by_asset(
    asset: str,
    _: HTTPAuthorizationCredentials = Depends(verify_token),
    db: Session = Depends(connection.get_db),
):
    """Returns the historical price data for the given asset"""
    if asset not in config.assets.keys():
        return HTTPException(status_code=400, detail=f"Invalid asset, must be one of {','.join(config.assets.keys())}")

    return transforms.get_asset_prices(db, asset=asset)


@router.post("/sync")
async def sync_trades(
    _: HTTPAuthorizationCredentials = Depends(verify_token), db: Session = Depends(connection.get_db)
):
    """Returns all trades"""
    global _last_indexed_trades

    if (datetime.datetime.now() - _last_indexed_trades) < datetime.timedelta(minutes=config.trades_cache_ttl_min):
        return {"status": "failed", "error": "rate limit exceeded"}

    try:
        jobs.index_recent_trades(db)
        _last_indexed_trades = datetime.datetime.now()
        return {"status": "success"}

    except Exception as e:
        return {"status": "failed", "error": str(e)}
