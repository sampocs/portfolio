import { Asset, PerformanceData } from "../data/types";
import { StorageService } from "./storage";

// Configuration
const API_BASE_URL = "https://portfolio-backend-production-29dc.up.railway.app";

// Get API token from storage (preferred) or environment variable (fallback)
const getApiToken = async (): Promise<string | null> => {
  // First try to get from AsyncStorage
  const storedToken = await StorageService.getApiKey();
  if (storedToken) {
    return storedToken;
  }
  
  // Fallback to environment variable for development
  return process.env.EXPO_PUBLIC_FASTAPI_SECRET || null;
};

// API service class
class ApiService {
  private async makeRequest<T>(endpoint: string, token?: string): Promise<T> {
    const apiToken = token || await getApiToken();
    if (!apiToken) {
      throw new Error("No API token available");
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  // Authenticate with invite code
  async authenticate(inviteCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.makeRequest<any>("/authenticate", inviteCode);
      return { success: true };
    } catch (error) {
      console.error("Authentication failed:", error);
      
      // Handle specific HTTP status codes
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
      
      // Default fallback message
      return { 
        success: false, 
        message: "Authentication failed. Please check your invite code and try again." 
      };
    }
  }

  async getPositions(): Promise<Asset[]> {
    return await this.makeRequest<Asset[]>("/positions");
  }

  async getPerformance(
    granularity: string,
    assets?: string[]
  ): Promise<PerformanceData[]> {
    let endpoint = `/performance/${granularity}`;
    if (assets && assets.length > 0) {
      const assetsParam = assets.join(",");
      endpoint += `?assets=${encodeURIComponent(assetsParam)}`;
    }

    return await this.makeRequest<PerformanceData[]>(endpoint);
  }
}

export const apiService = new ApiService();
