/**
 * Application Constants
 * 
 * Centralized location for all magic numbers, timing values,
 * and other constants used throughout the application.
 */

// Timing Constants
export const TIMING = {
  LONG_PRESS_DURATION: 2000, // 2 seconds for portfolio header long press
  CACHE_EXPIRY_MINUTES: 60, // 1 hour cache expiry for performance data
  ANIMATION_DURATION: 1000, // 1 second for loading animations
  PULSE_ANIMATION_DURATION: 1000, // 1 second pulse duration
  SMOOTH_TRANSITION_DELAY: 30, // 30ms delay for smooth transitions
} as const;

// UI Constants
export const UI = {
  CHART_HEIGHT: 200,
  DONUT_CHART_SIZE: 258,
  ASSET_ROW_HEIGHT: 60,
  LEGEND_ROW_HEIGHT: 72,
  CATEGORY_BUTTON_HEIGHT: 32,
  DURATION_BUTTON_HEIGHT: 28,
  LOADING_OPACITY_MIN: 0.3,
  LOADING_OPACITY_MAX: 0.8,
  TOUCHABLE_OPACITY_ACTIVE: 0.5,
} as const;

// Data Constants
export const DATA = {
  MIN_PORTFOLIO_VALUE_PERCENTAGE: 85, // Never go below 85% of cost basis in mock data
  MOCK_DATA_DAYS: 120, // Number of days of mock performance data
  STARTING_PORTFOLIO_VALUE: 95000,
  FINAL_PORTFOLIO_VALUE: 139652.52,
  FINAL_PORTFOLIO_COST: 118296.62,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  API_KEY: 'PORTFOLIO_API_KEY',
  ONBOARDING_COMPLETED: 'PORTFOLIO_ONBOARDING_COMPLETED',
  DATA_MODE: 'PORTFOLIO_DATA_MODE',
} as const;

// API Configuration
export const API = {
  BASE_URL: 'https://portfolio-backend-production-29dc.up.railway.app',
  REQUEST_TIMEOUT: 120000, // 2 minutes default timeout
} as const;

// Chart Configuration
export const CHART = {
  VOLATILITY: {
    SHORT_TERM_MULTIPLIER: 0.2,
    MEDIUM_TERM_MULTIPLIER: 0.05,
    SHORT_TERM_AMPLITUDE: 2000,
    MEDIUM_TERM_AMPLITUDE: 5000,
    RANDOM_AMPLITUDE: 3000,
    CORRECTION_AMPLITUDE: 8000,
    CORRECTION_START_DAY: 60,
    CORRECTION_END_DAY: 80,
  },
} as const;

// Duration Configuration
export const DURATIONS = {
  // All available portfolio durations
  PORTFOLIO: ['1W', '1M', 'YTD', '1Y', '5Y', 'ALL'] as const,
  
  // All available asset durations  
  ASSET: ['1D', '1W', '1M', 'YTD', '1Y', '5Y'] as const,
  
  // Initial load durations (what gets loaded first)
  INITIAL_PORTFOLIO: '1Y' as const,
  INITIAL_ASSET: '1Y' as const,
  
  // Helper function to get background preload durations
  getBackgroundPreloadDurations: () => {
    return DURATIONS.PORTFOLIO.filter(duration => duration !== DURATIONS.INITIAL_PORTFOLIO);
  }
} as const;

// Color Constants (extracted from theme but as constants for reference)
export const COLORS = {
  SKELETON: '#404040', // Loading screen skeleton color
} as const;