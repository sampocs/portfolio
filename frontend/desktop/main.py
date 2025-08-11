import streamlit as st
import pandas as pd
import numpy as np
import requests
import dotenv
import os
from pathlib import Path
import re
from decimal import Decimal, ROUND_DOWN

st.markdown("## Positions")


def camel_to_title(s: str):
    """Convert from camel case to title case"""
    spaced = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    return spaced.title().replace("_", " ")


current_file = Path(__file__).resolve()
project_home = current_file.parent.parent.parent
env_file = project_home / ".env"

dotenv.load_dotenv(env_file)
API_SECRET = os.environ["FASTAPI_SECRET"]

POSITIONS_ENDPOINT = "https://portfolio-backend-production-29dc.up.railway.app/positions"

position_response = requests.get(POSITIONS_ENDPOINT, headers={"Authorization": f"Bearer {API_SECRET}"})
position_data = position_response.json()

df = pd.DataFrame(position_data)


for col in [
    "quantity",
    "current_price",
    "average_price",
    "cost",
    "value",
    "returns",
    "current_allocation",
    "target_allocation",
]:
    decimals = Decimal("0.01") if col != "quantity" else Decimal("0.000001")
    df[col] = df[col].map(lambda i: Decimal(i).quantize(decimals, rounding=ROUND_DOWN))

category_priority = {"Stock ETFs": 1, "Crypto Tokens": 2, "Crypto Stocks": 3, "Gold": 4, "Real Estate": 5}

df["category_priority"] = df["category"].map(category_priority).fillna(999)  # Unknown categories go to end
df = df.sort_values(by=["category_priority", "target_allocation"], ascending=[True, False]).reset_index(drop=True)
df = df.drop("category_priority", axis=1)


df_display = df.copy()
df_display["category"] = df_display["category"].mask(df_display["category"].duplicated(), "")


# Price columns -  dollar sign with commas and 2 decimals
for col in ["current_price", "average_price", "cost", "value"]:
    if col in df_display.columns:
        df_display[col] = df_display[col].apply(lambda i: f"${float(i):,.2f}")

# Allocation columns - percentage with 2 decimals
for col in ["returns", "current_allocation"]:
    if col in df_display.columns:
        df_display[col] = df_display[col].apply(lambda i: f"{float(i):.2f}%")

df_display["target_allocation"] = df_display["target_allocation"].apply(lambda i: f"{i:.0f}%")


def color_cells(val):
    decimal_val = Decimal(val.replace("%", ""))
    if decimal_val > Decimal(0):
        color = "#AEE6A0"
    elif decimal_val < Decimal(0):
        color = "#FFADAD"
    else:
        color = "white"
    return f"background-color: {color}"


df_display = df_display.rename(columns={c: camel_to_title(c) for c in df_display.columns})

df_display = df_display.style.map(color_cells, subset=["Returns"])
st.dataframe(df_display, hide_index=True, use_container_width=True)

st.markdown("## Trades")
