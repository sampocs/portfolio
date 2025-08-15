import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * StorageService - Handles all AsyncStorage operations for the app
 * 
 * Provides a centralized service for managing persistent storage
 * including API keys, onboarding status, and user preferences.
 */

export class StorageService {
  /**
   * Store API key securely in AsyncStorage
   */
  static async storeApiKey(apiKey: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    } catch (error) {
      console.error('Error storing API key:', error);
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Retrieve stored API key from AsyncStorage
   */
  static async getApiKey(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
    } catch (error) {
      console.error('Error retrieving API key:', error);
      return null;
    }
  }

  /**
   * Remove API key from AsyncStorage (for logout functionality)
   */
  static async removeApiKey(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.API_KEY);
    } catch (error) {
      console.error('Error removing API key:', error);
      throw new Error('Failed to remove API key');
    }
  }

  /**
   * Check if user is authenticated (has valid API key stored)
   */
  static async isAuthenticated(): Promise<boolean> {
    const apiKey = await StorageService.getApiKey();
    return apiKey !== null && apiKey.length > 0;
  }

  /**
   * Mark onboarding as completed
   */
  static async setOnboardingCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    } catch (error) {
      console.error('Error setting onboarding completed:', error);
    }
  }

  /**
   * Check if user has completed onboarding
   */
  static async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Clear onboarding status (for testing/reset)
   */
  static async clearOnboardingStatus(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    } catch (error) {
      console.error('Error clearing onboarding status:', error);
    }
  }

  /**
   * Store user's preferred data mode (live or demo)
   */
  static async storeDataMode(mode: 'live' | 'demo'): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DATA_MODE, mode);
    } catch (error) {
      console.error('Error storing data mode:', error);
    }
  }

  /**
   * Retrieve user's preferred data mode
   */
  static async getDataMode(): Promise<'live' | 'demo' | null> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.DATA_MODE);
      return mode as 'live' | 'demo' | null;
    } catch (error) {
      console.error('Error retrieving data mode:', error);
      return null;
    }
  }

  /**
   * Clear data mode preference (for testing/reset)
   */
  static async clearDataMode(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.DATA_MODE);
    } catch (error) {
      console.error('Error clearing data mode:', error);
    }
  }
}