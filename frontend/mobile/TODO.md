# React Native Portfolio App - TODO

## Overview

Building a React Native application to display investment portfolio information with two main tabs: Portfolio and Allocations. The app follows a dark theme inspired by Delta by Toro.

## High-Level Tasks

### 1. Project Setup

- [x] Scaffold the React Native application inside `/frontend/mobile`
  - [x] Initialize React Native project in existing monorepo structure
  - [x] Ensure all packages are up to date
  - [x] Configure project for iOS development
  - [x] Install and configure necessary dependencies
  - [x] Start with expo, but ensure we can export it later since this will eventually be deployed to the app store.
  - [x] Ensure the main react project starts in /frontend/mobile (rather than being under a separate nested directory). You can call the app "Portfolio"

### 2. Navigation & Screens

- [x] Create the two tabs: "Portfolio" and "Allocations"
  - [x] Portfolio tab with line/pie chart icon
  - [x] Allocations tab with bar chart icon
  - [x] Create PortfolioScreen component
  - [x] Create AllocationsScreen component
  - [x] Add pinned header component for each screen showing tab name
  - [x] Implement ScrollView for main content below header

### 3. Design System

- [x] Define app styling and color scheme file
  - [x] Implement color scheme with standard naming:
    - background: #000000 (primary screen background)
    - foreground: #F5F5F5 (primary text)
    - muted: #999999 (secondary text)
    - card: #171717 (component backgrounds)
    - accent: #242424 (selected elements)
    - destructive: #FF3249 (red for losses)
    - destructive-foreground: #48070F (red highlight background)
    - success: #34D86C (green for gains)
    - success-foreground: #00351D (green highlight background)
  - [x] Install and configure Roobertpro font (using system fonts as equivalent)
  - [x] Create theme constants and styling utilities

### 4. Data Layer

- [x] Setup mock data structure for development
  - [x] Create positions mock data based on assets.yaml
  - [x] Create performance mock data with time series
  - [x] Define TypeScript interfaces for API responses

### 5. Portfolio Screen Components

#### 5.1 Category Selector Component

- [x] Create toggleable buttons for "Crypto" and "Stocks"
- [x] Implement button styling (outline, background, colors)
- [x] Add toggle state management
- [x] Position horizontally with Stocks left, Crypto right

#### 5.2 Summary Component

- [x] Display "Total Worth" label in muted color
- [x] Show total portfolio value (large, bold, formatted)
- [x] Add "USD" text with proper alignment and sizing
- [x] Calculate and display gains/losses in dollars
- [x] Show percentage gains/losses with colored highlights
- [x] Implement proper number formatting with commas and decimals

#### 5.3 Total Worth Chart Component

- [x] Implement chart - see CHART.md#spec for detailed spec
- [x] Add duration selector buttons (1W, 1M, YTD, 1Y, ALL)
- [x] Implement duration button styling and selection

#### 5.4 Asset List Component

- [x] Create individual asset components
- [x] Add asset logos from assets.yaml paths
- [x] Display asset ticker (bold) and quantity|price (muted)
- [x] Show total value, gains/losses, and returns
- [x] Implement proper styling with card background
- [x] Stack components vertically

### 6. API Integration

- [x] Integrate with actual API endpoints
  - [x] Setup authentication with FASTAPI_SECRET bearer token
  - [x] Connect positions endpoint: `/positions`
  - [x] Connect performance endpoint: `/performance/{granularity}`
  - [x] Map granularity from chart duration selection
  - [x] Replace mock data with API calls
  - [x] Add loading states and error handling

### 7. Allocations Tab (Future)

- [ ] Spec and implement allocations screen (to be defined later)

## API Details

- Base URL: https://portfolio-backend-production-29dc.up.railway.app/
- Authentication: Bearer token from FASTAPI_SECRET env variable
- Endpoints: `/positions`, `/performance/{granularity}`
- Granularity options: "1W", "1M", "YTD", "1Y", "ALL"

## Testing & Validation

- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Validate all components render correctly
- [ ] Test API integration and error handling
- [ ] Verify responsive design and interactions
