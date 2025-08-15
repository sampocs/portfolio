import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE_KEY = 'PORTFOLIO_API_KEY';
const ONBOARDING_COMPLETED_KEY = 'PORTFOLIO_ONBOARDING_COMPLETED';
const DATA_MODE_KEY = 'PORTFOLIO_DATA_MODE';

export class StorageService {
  // Store API key in AsyncStorage
  static async storeApiKey(apiKey: string): Promise<void> {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      console.log('API key stored successfully');
    } catch (error) {
      console.error('Error storing API key:', error);
      throw new Error('Failed to store API key');
    }
  }

  // Retrieve API key from AsyncStorage
  static async getApiKey(): Promise<string | null> {
    try {
      const apiKey = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
      return apiKey;
    } catch (error) {
      console.error('Error retrieving API key:', error);
      return null;
    }
  }

  // Remove API key from AsyncStorage (for logout functionality)
  static async removeApiKey(): Promise<void> {
    try {
      await AsyncStorage.removeItem(API_KEY_STORAGE_KEY);
      console.log('API key removed successfully');
    } catch (error) {
      console.error('Error removing API key:', error);
      throw new Error('Failed to remove API key');
    }
  }

  // Check if user is authenticated (has valid API key stored)
  static async isAuthenticated(): Promise<boolean> {
    const apiKey = await StorageService.getApiKey();
    return apiKey !== null && apiKey.length > 0;
  }

  // Mark onboarding as completed
  static async setOnboardingCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      console.log('Onboarding marked as completed');
    } catch (error) {
      console.error('Error setting onboarding completed:', error);
    }
  }

  // Check if user has completed onboarding
  static async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  // Clear onboarding status (for testing/reset)
  static async clearOnboardingStatus(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      console.log('Onboarding status cleared');
    } catch (error) {
      console.error('Error clearing onboarding status:', error);
    }
  }

  // Store user's preferred data mode
  static async storeDataMode(mode: 'live' | 'demo'): Promise<void> {
    try {
      await AsyncStorage.setItem(DATA_MODE_KEY, mode);
      console.log('Data mode stored:', mode);
    } catch (error) {
      console.error('Error storing data mode:', error);
    }
  }

  // Retrieve user's preferred data mode
  static async getDataMode(): Promise<'live' | 'demo' | null> {
    try {
      const mode = await AsyncStorage.getItem(DATA_MODE_KEY);
      return mode as 'live' | 'demo' | null;
    } catch (error) {
      console.error('Error retrieving data mode:', error);
      return null;
    }
  }

  // Clear data mode preference (for testing/reset)
  static async clearDataMode(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DATA_MODE_KEY);
      console.log('Data mode preference cleared');
    } catch (error) {
      console.error('Error clearing data mode:', error);
    }
  }
}