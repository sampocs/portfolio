import { Asset, PerformanceData } from "../data/types";
import { StorageService } from "./storage";
import { API } from "../constants";

/**
 * ApiService - Handles all API communication with the backend
 * 
 * Provides methods for authentication, fetching positions data,
 * and retrieving performance metrics with proper error handling.
 */

/**
 * Get API token from storage or environment variable fallback
 */
const getApiToken = async (): Promise<string | null> => {
  const storedToken = await StorageService.getApiKey();
  if (storedToken) {
    return storedToken;
  }
  
  // Fallback to environment variable for development
  return process.env.EXPO_PUBLIC_FASTAPI_SECRET || null;
};

class ApiService {
  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(endpoint: string, token?: string, method: string = "GET", body?: any): Promise<T> {
    const apiToken = token || await getApiToken();
    if (!apiToken) {
      throw new Error("No API token available");
    }

    const response = await fetch(`${API.BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Authenticate user with invite code
   */
  async authenticate(inviteCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.makeRequest<any>("/authenticate", inviteCode);
      return { success: true };
    } catch (error) {
      console.error("Authentication failed:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          return { success: false, message: "Invalid invite code" };
        }
        if (error.message.includes("403")) {
          return { success: false, message: "Access denied" };
        }
        if (error.message.includes("429")) {
          return { success: false, message: "Too many attempts. Please try again later." };
        }
        if (error.message.includes("500")) {
          return { success: false, message: "Server error. Please try again." };
        }
      }
      
      return { 
        success: false, 
        message: "Authentication failed. Please check your invite code and try again." 
      };
    }
  }

  /**
   * Fetch user's current asset positions
   */
  async getPositions(): Promise<Asset[]> {
    return await this.makeRequest<Asset[]>("/positions");
  }

  /**
   * Fetch performance data for specified granularity and assets
   */
  async getPerformanceData(
    granularity: string,
    assetSymbols?: string[]
  ): Promise<PerformanceData[]> {
    let endpoint = `/performance/${granularity}`;
    if (assetSymbols && assetSymbols.length > 0) {
      const assetsQueryParam = assetSymbols.join(",");
      endpoint += `?assets=${encodeURIComponent(assetsQueryParam)}`;
    }

    return await this.makeRequest<PerformanceData[]>(endpoint);
  }

  /**
   * Fetch asset price data
   */
  async getAssetPrices(symbol: string): Promise<any> {
    return await this.makeRequest<any>(`/prices/${symbol}`);
  }

  /**
   * Fetch asset trade data
   */
  async getAssetTrades(symbol: string): Promise<any[]> {
    return await this.makeRequest<any[]>(`/trades/${symbol}`);
  }

  /**
   * Trigger manual sync of trades from brokers
   */
  async syncTrades(): Promise<{ status: string; error?: string }> {
    try {
      const response = await this.makeRequest<{ status: string; error?: string }>("/sync", undefined, "POST");
      return response;
    } catch (error) {
      console.error("Sync trades failed:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("429")) {
          return { 
            status: "failed", 
            error: "Sync rate limited. Please wait before trying again." 
          };
        }
        if (error.message.includes("500")) {
          return { 
            status: "failed", 
            error: "Server error during sync. Please try again later." 
          };
        }
      }
      
      return { 
        status: "failed", 
        error: "Failed to sync trades. Please try again." 
      };
    }
  }
}

export const apiService = new ApiService();
