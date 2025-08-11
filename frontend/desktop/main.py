import streamlit as st
import pandas as pd
import numpy as np
import requests
import dotenv
import os
from pathlib import Path
import re
from decimal import Decimal, ROUND_DOWN

# Configure page layout for better table display
st.set_page_config(page_title="Portfolio Positions", layout="wide")

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
# For proper category merging, we'll handle this differently
category_groups = []
current_category = None
for idx, row in df_display.iterrows():
    if current_category != row['category']:
        current_category = row['category']
        category_groups.append((idx, current_category))
    else:
        category_groups.append((idx, ''))

# Apply the category grouping
for i, (idx, cat) in enumerate(category_groups):
    df_display.at[idx, 'category'] = cat


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


def style_rows(s):
    """Add alternating row colors with light blue"""
    styles = []

    for idx, _ in s.iterrows():
        # Alternating row colors (light blue for even rows)
        if idx % 2 == 0:
            row_color = "background-color: #f0f8ff"
        else:
            row_color = "background-color: white"

        # Apply row color to all columns except Returns which has specific coloring
        row_styles = [row_color if col != 'Returns' else '' for col in s.columns]
        styles.append(row_styles)

    return pd.DataFrame(styles, index=s.index, columns=s.columns)


df_display = df_display.rename(columns={c: camel_to_title(c) for c in df_display.columns})

# Apply styling with alternating rows and return colors
styled_df = df_display.style.apply(style_rows, axis=None).map(color_cells, subset=["Returns"])

# Custom CSS for better table appearance
st.markdown(
    """
<style>
/* Make table cells auto-size to content and prevent cutoff */
.stDataFrame table {
    table-layout: auto !important;
    width: 100% !important;
}

.stDataFrame td, .stDataFrame th {
    white-space: nowrap !important;
    padding: 8px 12px !important;
    text-align: left !important;
}

/* Ensure container takes full width and height without scroll issues */
.stDataFrame {
    width: 100% !important;
    height: auto !important;
    max-height: 80vh !important;
    overflow: auto !important;
}

/* Category column styling for merged appearance */
.stDataFrame td:first-child {
    font-weight: 600;
    border-right: 2px solid #e0e0e0;
}

/* Better spacing and visual merging for category cells */
.stDataFrame tbody tr td:first-child:empty {
    border-top: none !important;
    border-bottom: none !important;
    position: relative;
}

.stDataFrame tbody tr td:first-child:not(:empty) {
    border-bottom: 2px solid #d0d0d0;
    vertical-align: top;
}
</style>
""",
    unsafe_allow_html=True,
)

# Display with full width
height = int(35 * (len(df_display) + 1) + 3)
st.dataframe(styled_df, hide_index=True, use_container_width=True, height=height)
