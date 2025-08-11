import streamlit as st
import pandas as pd
import requests
import dotenv
import os
from pathlib import Path
import re
from decimal import Decimal, ROUND_DOWN

current_file = Path(__file__).resolve()
project_home = current_file.parent.parent.parent
env_file = project_home / ".env"

dotenv.load_dotenv(env_file)
API_SECRET = os.environ["FASTAPI_SECRET"]

POSITIONS_ENDPOINT = "https://portfolio-backend-production-29dc.up.railway.app/positions"
TRADES_ENDPOINT = "https://portfolio-backend-production-29dc.up.railway.app/trades"


st.set_page_config(page_title="Portfolio Positions", layout="wide")


def camel_to_title(s: str):
    """Convert from camel case to title case"""
    spaced = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    return spaced.title().replace("_", " ")


@st.cache_data(ttl=60)  # 1min cache
def fetch_portfolio_data():
    """Fetch positions and trades data from API with caching"""
    position_response = requests.get(POSITIONS_ENDPOINT, headers={"Authorization": f"Bearer {API_SECRET}"})
    trades_response = requests.get(TRADES_ENDPOINT, headers={"Authorization": f"Bearer {API_SECRET}"})

    position_data = position_response.json()
    trades_data = trades_response.json()

    return position_data, trades_data


position_data, trades_data = fetch_portfolio_data()

positions_df = pd.DataFrame(position_data)
trades_df = pd.DataFrame(trades_data)


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
    positions_df[col] = positions_df[col].map(lambda i: Decimal(i).quantize(decimals, rounding=ROUND_DOWN))

category_priority = {"Stock ETFs": 1, "Crypto Tokens": 2, "Crypto Stocks": 3, "Gold": 4, "Real Estate": 5}

positions_df["category_priority"] = positions_df["category"].map(category_priority).fillna(999)
positions_df = positions_df.sort_values(
    by=["category_priority", "target_allocation"], ascending=[True, False]
).reset_index(drop=True)
positions_df = positions_df.drop("category_priority", axis=1)


positions_df_display = positions_df.copy()
# For proper category merging, we'll handle this differently
category_groups = []
current_category = None
for idx, row in positions_df_display.iterrows():
    if current_category != row['category']:
        current_category = row['category']
        category_groups.append((idx, current_category))
    else:
        category_groups.append((idx, ''))

# Apply the category grouping
for i, (idx, cat) in enumerate(category_groups):
    positions_df_display.at[idx, 'category'] = cat


# Price columns -  dollar sign with commas and 2 decimals
for col in ["current_price", "average_price", "cost", "value"]:
    if col in positions_df_display.columns:
        positions_df_display[col] = positions_df_display[col].apply(lambda i: f"${float(i):,.2f}")

# Allocation columns - percentage with 2 decimals
for col in ["returns", "current_allocation"]:
    if col in positions_df_display.columns:
        positions_df_display[col] = positions_df_display[col].apply(lambda i: f"{float(i):.2f}%")

positions_df_display["target_allocation"] = positions_df_display["target_allocation"].apply(lambda i: f"{i:.0f}%")


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


positions_df_display = positions_df_display.rename(columns={c: camel_to_title(c) for c in positions_df_display.columns})

# Apply styling with alternating rows and return colors
styled_df = positions_df_display.style.apply(style_rows, axis=None).map(color_cells, subset=["Returns"])

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

/* Hide index column when using to_html */
table th:first-child,
table td:first-child {
    display: none;
}

/* Bold asset column in positions table */
table tbody tr td:nth-child(2) {
    font-weight: bold;
}
</style>
""",
    unsafe_allow_html=True,
)

# Display with full width
height = int(35 * (len(positions_df_display) + 1) + 3)
st.markdown("## Positions")
st.write(styled_df.to_html(index=False), unsafe_allow_html=True)

st.divider()
st.markdown("## Trades")

col1, col2, col3 = st.columns([1, 1, 6])

all_assets = list(trades_df["asset"].unique())
trade_types = ["Buy", "Sell"]

with col1:
    with st.popover("Assets", width=200):
        st.write("Select one or more:")

        if st.button("Toggle All", key="toggle_all"):
            all_enabled = all(st.session_state[asset] for asset in all_assets)
            new_state = False if all_enabled else True
            for asset in all_assets:
                st.session_state[asset] = new_state

        st.divider()
        asset_checkboxes = {opt: st.checkbox(opt, value=(opt in set(all_assets)), key=opt) for opt in all_assets}
with col2:
    with st.popover("Trade Type", width=200):
        st.write("Select one or more:")
        trade_type_checkboxes = {opt: st.checkbox(opt, value=(opt in set(trade_types)), key=opt) for opt in trade_types}

selected_assets = [asset for asset, selected in asset_checkboxes.items() if selected]
selected_trades = [trade_type.upper() for trade_type, selected in trade_type_checkboxes.items() if selected]
trades_df = trades_df[trades_df.asset.isin(selected_assets)]
trades_df = trades_df[trades_df.action.isin(selected_trades)]

for col in ["price", "cost", "value", "fees"]:
    if col in trades_df.columns:
        trades_df[col] = trades_df[col].apply(lambda i: f"${float(i):,.2f}")

trades_df["quantity"] = trades_df["quantity"].apply(lambda i: f"{float(i):,.6f}")

trades_df = trades_df[["asset", "date", "action", "price", "quantity", "cost", "value", "fees"]]
trades_df = trades_df.rename(columns={c: c.capitalize() for c in trades_df.columns})

st.dataframe(trades_df, hide_index=True)
