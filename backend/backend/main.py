from fastapi import FastAPI
from backend.jobs import schedules
from backend.router import routes
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Controls the app startup and shutdown with scheduled jobs"""
    scheduler = schedules.get_scheduler()
    scheduler.start()
    yield  # main app flow
    scheduler.shutdown()


app = FastAPI(title="Portfolio Tracker", lifespan=lifespan)

app.include_router(routes.router)
