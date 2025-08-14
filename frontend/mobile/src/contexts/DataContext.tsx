import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Asset } from '../data/types';
import { apiService } from '../services/api';

interface DataContextType {
  positions: Asset[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
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
  const [positions, setPositions] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (isRefresh = false) => {
    try {
      setError(null);
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const positionsData = await apiService.getPositions();
      setPositions(positionsData);
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
    await fetchData(true);
  };

  // Initial data load
  useEffect(() => {
    fetchData();
  }, []);

  const value: DataContextType = {
    positions,
    isLoading,
    isRefreshing,
    error,
    refreshData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}