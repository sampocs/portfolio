# Asset Detail Page - Implementation Plan

## Overview

Individual asset detail pages accessible by tapping assets on the Portfolio screen. Each page displays comprehensive asset information including price history, portfolio holdings, and trading history.

## High-Level Tasks

### 1. Data Layer & Mock Data

- [ ] Create asset-specific data types and interfaces
  - [ ] Define `AssetPriceData` interface for price history endpoint
  - [ ] Define `AssetTradeData` interface for trades endpoint
  - [ ] Define `AssetDetailData` interface combining price and portfolio data
- [ ] Create mock data service for asset details
  - [ ] Mock price history data for all assets (1D, 1W, 1M, YTD, 1Y)
  - [ ] Mock trade history data for all assets
  - [ ] Mock data generation utilities for realistic financial data
- [ ] Extend existing data context or create asset-specific context

### 2. Navigation Integration

- [ ] Configure navigation stack for asset detail screen
  - [ ] Add AssetDetailScreen to navigation structure
  - [ ] Configure navigation parameters (asset symbol, asset data)
- [ ] Make AssetRow components touchable on Portfolio screen
  - [ ] Add onPress handler to AssetRow component
  - [ ] Pass asset data and navigation to detail screen
  - [ ] Implement smooth navigation transitions

### 3. Generalized Chart Component

- [ ] Extract chart logic into reusable component
  - [ ] Create `FinancialChart` component from existing `TotalWorthChart`
  - [ ] Make chart data format agnostic (portfolio value vs asset price)
  - [ ] Support different chart modes (portfolio/asset)
  - [ ] Maintain existing chart features (crosshair, gradient, smooth curves)
- [ ] Refactor existing Portfolio screen to use generalized chart
- [ ] Create asset-specific chart integration

### 4. Duration Selector Component

- [ ] Extract duration selector into reusable component
  - [ ] Create `DurationSelector` component from existing chart duration logic
  - [ ] Support different duration sets (portfolio vs asset)
  - [ ] Portfolio: 1W, 1M, YTD, 1Y, ALL
  - [ ] Asset: 1D, 1W, 1M, YTD, 1Y
- [ ] Refactor Portfolio screen to use generalized selector
- [ ] Integrate duration selector with asset price data

### 5. Asset Detail Screen Implementation

#### 5.1 Screen Structure & Header
- [ ] Create AssetDetailScreen component
- [ ] Implement dynamic header with asset ticker
- [ ] Add back navigation to Portfolio screen
- [ ] Apply consistent styling and safe area handling

#### 5.2 Price Display Section
- [ ] Create AssetPriceHeader component
  - [ ] Display current/live price prominently
  - [ ] Show percentage change for selected timeframe
  - [ ] Apply success/destructive coloring based on performance
  - [ ] Format prices with appropriate precision
- [ ] Integrate with duration selector for dynamic updates

#### 5.3 Price Chart Integration
- [ ] Implement asset price chart using generalized FinancialChart
- [ ] Process price history data for chart consumption
- [ ] Handle duration-based data filtering (1D, 1W, 1M, YTD, 1Y)
- [ ] Append live price as current data point
- [ ] Implement chart interactions (crosshair, point selection)

#### 5.4 Portfolio Holdings Summary
- [ ] Create AssetHoldingsSummary component
  - [ ] Display total amount invested in asset
  - [ ] Show current total value of holdings
  - [ ] Calculate and display dollar gain/loss
  - [ ] Calculate and display percentage return
  - [ ] Apply consistent styling with PortfolioSummary

#### 5.5 Trading History Section
- [ ] Create TradesList component
  - [ ] Section header: "Trades"
  - [ ] Scrollable list of trade entries
- [ ] Create TradeRow component
  - [ ] Match AssetRow styling (card background, borders, radius)
  - [ ] Display trade action (BUY/SELL) with appropriate coloring
  - [ ] Show trade date, quantity, price, total value
  - [ ] Format monetary values consistently
  - [ ] Handle first/last row border radius styling

### 6. Data Processing & Business Logic

- [ ] Implement asset price data processing
  - [ ] Duration-based data filtering utilities
  - [ ] Live price integration with historical data
  - [ ] Price change calculations for different timeframes
- [ ] Implement portfolio calculations for individual assets
  - [ ] Calculate total invested amount from trades
  - [ ] Calculate current position value
  - [ ] Calculate asset-specific returns and percentages
- [ ] Create asset data fetching service (mock initially)

### 7. Integration & Testing

- [ ] Integrate all components into AssetDetailScreen
- [ ] Test navigation flow from Portfolio to Asset detail
- [ ] Verify data consistency between Portfolio and Asset views
- [ ] Test duration selector interactions and chart updates
- [ ] Validate styling consistency across all components
- [ ] Test with various asset types and trade histories

### 8. API Integration (Future)

- [ ] Replace mock data with API integration
  - [ ] Implement `/prices/{asset}` endpoint integration
  - [ ] Implement `/trades/{asset}` endpoint integration
  - [ ] Add loading states and error handling
  - [ ] Implement data caching for performance
- [ ] Add pull-to-refresh functionality
- [ ] Handle edge cases (no trades, insufficient price data)

## Component Architecture

```
AssetDetailScreen
├── AssetDetailHeader (ticker, back navigation)
├── ScrollView
│   ├── AssetPriceHeader (price, % change)
│   ├── DurationSelector (1D, 1W, 1M, YTD, 1Y)
│   ├── FinancialChart (generalized chart component)
│   ├── AssetHoldingsSummary (investment summary)
│   └── TradesList
│       └── TradeRow[] (individual trades)
```

## Data Flow

1. User taps asset on Portfolio screen
2. Navigate to AssetDetailScreen with asset symbol
3. Fetch price history and trade data (mock/API)
4. Process data for selected duration
5. Display price, chart, holdings, and trades
6. Handle duration changes and update display

## Styling Requirements

- Maintain dark theme consistency
- Use existing color palette and typography
- Match card styling patterns from Portfolio screen
- Ensure consistent spacing and border radius
- Apply appropriate color coding for financial data

## File Structure

```
src/
├── screens/
│   └── AssetDetailScreen.tsx
├── components/
│   ├── FinancialChart.tsx (generalized)
│   ├── DurationSelector.tsx (generalized)
│   ├── AssetPriceHeader.tsx
│   ├── AssetHoldingsSummary.tsx
│   ├── TradesList.tsx
│   └── TradeRow.tsx
├── data/
│   ├── mockAssetData.ts
│   └── assetTypes.ts
└── services/
    └── assetService.ts
```