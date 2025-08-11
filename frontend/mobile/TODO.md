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

- [ ] Define app styling and color scheme file
  - [ ] Implement color scheme with standard naming:
    - background: #000000 (primary screen background)
    - foreground: #F5F5F5 (primary text)
    - muted: #999999 (secondary text)
    - card: #171717 (component backgrounds)
    - accent: #242424 (selected elements)
    - destructive: #FF3249 (red for losses)
    - destructive-foreground: #48070F (red highlight background)
    - success: #34D86C (green for gains)
    - success-foreground: #00351D (green highlight background)
  - [ ] Install and configure Roobertpro font
  - [ ] Create theme constants and styling utilities

### 4. Data Layer

- [ ] Setup mock data structure for development
  - [ ] Create positions mock data based on assets.yaml
  - [ ] Create performance mock data with time series
  - [ ] Define TypeScript interfaces for API responses

### 5. Portfolio Screen Components

#### 5.1 Category Selector Component

- [ ] Create toggleable buttons for "Crypto" and "Stocks"
- [ ] Implement button styling (outline, background, colors)
- [ ] Add toggle state management
- [ ] Position horizontally with Stocks left, Crypto right

#### 5.2 Summary Component

- [ ] Display "Total Worth" label in muted color
- [ ] Show total portfolio value (large, bold, formatted)
- [ ] Add "USD" text with proper alignment and sizing
- [ ] Calculate and display gains/losses in dollars
- [ ] Show percentage gains/losses with colored highlights
- [ ] Implement proper number formatting with commas and decimals

#### 5.3 Total Worth Chart Component

- [ ] Implement smooth line chart with no grid/axes
- [ ] Add min/max value labels with horizontal lines
- [ ] Color line based on positive/negative returns (success/destructive)
- [ ] Implement interactive pan/touch functionality
- [ ] Add vertical line snapping to data points
- [ ] Update summary values on chart interaction
- [ ] Show date when point is selected
- [ ] Add duration selector buttons (1W, 1M, YTD, 1Y, ALL)
- [ ] Implement duration button styling and selection

#### 5.4 Asset List Component

- [ ] Create individual asset components
- [ ] Add asset logos from assets.yaml paths
- [ ] Display asset ticker (bold) and quantity|price (muted)
- [ ] Show total value, gains/losses, and returns
- [ ] Implement proper styling with card background
- [ ] Stack components vertically

### 6. API Integration

- [ ] Integrate with actual API endpoints
  - [ ] Setup authentication with FASTAPI_SECRET bearer token
  - [ ] Connect positions endpoint: `/positions`
  - [ ] Connect performance endpoint: `/performance/{granularity}`
  - [ ] Map granularity from chart duration selection
  - [ ] Replace mock data with API calls
  - [ ] Add loading states and error handling

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
