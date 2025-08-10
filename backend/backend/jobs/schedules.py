from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from backend.jobs import jobs
from backend.database import connection

TIMEZONE = "America/Chicago"


def get_scheduler() -> AsyncIOScheduler:
    """
    Create a scheduler with the following jobs:
     - Fill previous historical prices every day at 5am CST
     - Fill previous historical positions every day at 5am CST
     - Index recent trades every 10 minutes
    """
    scheduler = AsyncIOScheduler()
    with connection.SessionLocal() as db:
        scheduler.add_job(jobs.fill_historical_prices, "cron", args=[db], hour=5, minute=0, timezone=TIMEZONE)
        scheduler.add_job(jobs.fill_historical_positions, "cron", args=[db], hour=5, minute=0, timezone=TIMEZONE)
        scheduler.add_job(jobs.index_recent_trades, "interval", args=[db], minutes=10)
    return scheduler
