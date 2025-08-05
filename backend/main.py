from fastapi import FastAPI

app = FastAPI(title="Portfolio Tracker")


@app.get("/status")
def health_check():
    return "ok"
