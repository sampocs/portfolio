import { Asset, PerformanceData } from "../data/types";
import { mockPositions, mockPerformanceData } from "../data/mockData";

// Configuration
const USE_MOCK_DATA = true; // Set to false to use real API
const API_BASE_URL = "https://portfolio-backend-production-29dc.up.railway.app";

// Get API token from environment variable
const getApiToken = (): string | null => {
  // In Expo, environment variables must be prefixed with EXPO_PUBLIC_
  return process.env.EXPO_PUBLIC_FASTAPI_SECRET || null;
};

// API service class
class ApiService {
  private async makeRequest<T>(endpoint: string): Promise<T> {
    if (USE_MOCK_DATA) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      throw new Error("Using mock data - API request not made");
    }

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
    try {
      return await this.makeRequest<Asset[]>("/positions");
    } catch (error) {
      if (USE_MOCK_DATA) {
        console.log("Using mock positions data");
        return mockPositions;
      }
      console.error("Failed to fetch positions:", error);
      throw error;
    }
  }

  async getPerformance(
    granularity: string,
    assets?: string[]
  ): Promise<PerformanceData[]> {
    try {
      let endpoint = `/performance/${granularity}`;
      if (assets && assets.length > 0) {
        const assetsParam = assets.join(",");
        endpoint += `?assets=${encodeURIComponent(assetsParam)}`;
      }

      return await this.makeRequest<PerformanceData[]>(endpoint);
    } catch (error) {
      if (USE_MOCK_DATA) {
        console.log(
          `Using mock performance data for ${granularity}${
            assets ? ` with assets: ${assets.join(", ")}` : ""
          }`
        );
        return mockPerformanceData;
      }
      console.error(
        `Failed to fetch performance data for ${granularity}:`,
        error
      );
      throw error;
    }
  }
}

export const apiService = new ApiService();
export { USE_MOCK_DATA };
