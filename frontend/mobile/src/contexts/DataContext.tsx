import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Asset } from '../data/types';
import { apiService } from '../services/api';
import { mockPositions } from '../data/mockData';

export type DataMode = 'live' | 'demo';

interface DataContextType {
  positions: Asset[]; // Computed property based on current mode
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  dataMode: DataMode;
  refreshData: () => Promise<void>;
  switchToDemo: () => void;
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
    // Only refresh if in live mode
    if (dataMode === 'live') {
      await fetchLiveData(true);
    }
  };

  // Simple instant switch to demo mode
  const switchToDemo = () => {
    setDataMode('demo');
    console.log('Switched to demo mode');
  };

  // Initial data load (always start in live mode)
  useEffect(() => {
    fetchLiveData();
  }, []);

  const value: DataContextType = {
    positions, // This is the computed property
    isLoading,
    isRefreshing,
    error,
    dataMode,
    refreshData,
    switchToDemo,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}