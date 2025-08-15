import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Asset } from '../data/types';
import { apiService } from '../services/api';
import { mockPositions } from '../data/mockData';
import { StorageService } from '../services/storage';

export type DataMode = 'live' | 'demo';

interface DataContextType {
  positions: Asset[]; // Computed property based on current mode
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  dataMode: DataMode;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  hasCompletedOnboarding: boolean;
  refreshData: () => Promise<void>;
  switchToDemo: () => Promise<void>;
  switchToLive: () => Promise<{ success: boolean; needsAuth?: boolean }>;
  setAuthenticated: (authenticated: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  // Store both live and demo data separately
  const [liveData, setLiveData] = useState<Asset[]>([]);
  const [demoData] = useState<Asset[]>(mockPositions); // Demo data is static
  const [dataMode, setDataMode] = useState<DataMode>('live');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  
  // Computed property: return appropriate data based on current mode
  const positions = dataMode === 'live' ? liveData : demoData;

  const fetchLiveData = async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const positionsData = await apiService.getPositions();
      setLiveData(positionsData); // Store in live data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('Error fetching positions data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const refreshData = async () => {
    // Only refresh if in live mode AND authenticated
    if (dataMode === 'live' && isAuthenticated) {
      await fetchLiveData(true);
    }
  };

  // Switch to demo mode and mark onboarding completed
  const switchToDemo = async () => {
    setDataMode('demo');
    await StorageService.storeDataMode('demo'); // Save preference
    await StorageService.setOnboardingCompleted();
    setHasCompletedOnboarding(true);
    console.log('Switched to demo mode and completed onboarding');
  };

  // Smart switch to live mode with authentication check
  const switchToLive = async (): Promise<{ success: boolean; needsAuth?: boolean }> => {
    setError(null);
    
    // Check if authenticated first
    const hasValidAuth = await StorageService.isAuthenticated();
    if (!hasValidAuth) {
      console.log('No valid authentication found - need to authenticate');
      return { success: false, needsAuth: true };
    }
    
    if (liveData.length > 0) {
      // We have cached live data - instant switch
      setDataMode('live');
      await StorageService.storeDataMode('live'); // Save preference
      console.log('Switched to live mode with cached data');
      return { success: true };
    } else {
      // No cached data - need to fetch and show loading
      console.log('Switching to live mode - fetching fresh data');
      setIsLoading(true);
      setDataMode('live'); // Switch mode first so UI shows live mode
      
      try {
        await fetchLiveData(false); // false = not a refresh, so it will use isLoading
        await StorageService.storeDataMode('live'); // Save preference
        return { success: true };
      } catch (error) {
        console.error('Error fetching live data during switch:', error);
        // Switch back to demo mode on error
        setDataMode('demo');
        await StorageService.storeDataMode('demo'); // Save demo preference on error
        return { success: false };
      }
    }
  };

  // Check authentication, onboarding status, and data mode preference on app start
  useEffect(() => {
    const checkAppStatus = async () => {
      const hasValidAuth = await StorageService.isAuthenticated();
      const completedOnboarding = await StorageService.hasCompletedOnboarding();
      const storedDataMode = await StorageService.getDataMode();
      
      setIsAuthenticated(hasValidAuth);
      setHasCompletedOnboarding(completedOnboarding);
      setIsCheckingAuth(false);
      
      if (hasValidAuth) {
        // User is authenticated - use stored data mode preference or default to live
        const preferredMode = storedDataMode || 'live';
        setDataMode(preferredMode);
        
        if (preferredMode === 'live') {
          await fetchLiveData();
        } else {
          setIsLoading(false);
        }
        
        if (!completedOnboarding) {
          await StorageService.setOnboardingCompleted();
          setHasCompletedOnboarding(true);
        }
        
        console.log('Authenticated user, restored data mode:', preferredMode);
      } else if (completedOnboarding) {
        // User completed onboarding but not authenticated - use stored preference or default to demo
        const preferredMode = storedDataMode || 'demo';
        setDataMode(preferredMode);
        setIsLoading(false);
        console.log('User completed onboarding, restored data mode:', preferredMode);
      } else {
        // New user - stay in live mode but don't fetch data
        // App.tsx will show WelcomeScreen for onboarding
        setIsLoading(false);
        console.log('New user, will show welcome screen for onboarding');
      }
    };
    
    checkAppStatus();
  }, []);

  // Function to update authentication status (called from WelcomeScreen)
  const setAuthenticatedAndFetchData = async (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    
    if (authenticated) {
      // Switch to live mode, fetch data, and mark onboarding completed
      setDataMode('live');
      await StorageService.storeDataMode('live'); // Save preference
      await fetchLiveData();
      await StorageService.setOnboardingCompleted();
      setHasCompletedOnboarding(true);
    }
  };

  const value: DataContextType = {
    positions, // This is the computed property
    isLoading,
    isRefreshing,
    error,
    dataMode,
    isAuthenticated,
    isCheckingAuth,
    hasCompletedOnboarding,
    refreshData,
    switchToDemo,
    switchToLive,
    setAuthenticated: setAuthenticatedAndFetchData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}