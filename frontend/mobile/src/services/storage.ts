import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE_KEY = 'PORTFOLIO_API_KEY';

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
}