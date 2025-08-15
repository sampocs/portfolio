import { Asset, PerformanceData } from "../data/types";

// Configuration
const API_BASE_URL = "https://portfolio-backend-production-29dc.up.railway.app";

// Get API token from environment variable
const getApiToken = (): string | null => {
  // In Expo, environment variables must be prefixed with EXPO_PUBLIC_
  return process.env.EXPO_PUBLIC_FASTAPI_SECRET || null;
};

// API service class
class ApiService {
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const token = getApiToken();
    if (!token) {
      throw new Error("FASTAPI_SECRET environment variable not set");
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
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
