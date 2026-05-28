/**
 * Centralized, production-grade API client wrapper for Project Memory OS.
 * Encapsulates fetch with automatic timeouts, network retries, typed errors,
 * and graceful fallback handling for backend downtime.
 */

const DEFAULT_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 2;

export class ApiError extends Error {
  status: number;
  statusText: string;
  detail: string;

  constructor(status: number, statusText: string, detail: string) {
    super(`API Error ${status}: ${detail || statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.detail = detail;
  }
}

export class BackendOfflineError extends Error {
  constructor() {
    super("The Memory OS API server is currently unreachable. Please verify your internet connection or check if the backend service is restarting.");
    this.name = "BackendOfflineError";
  }
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  token?: string;
  skipRetry?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Enhanced fetch client with timeout and network retry capabilities.
 */
async function fetchWithRetry(
  url: string,
  options: RequestOptions = {},
  retryCount = 0
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, token, skipRetry = false, ...fetchOptions } = options;

  // 1. Prepare Request Headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  fetchOptions.headers = headers;

  // 2. Setup Timeout Controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  fetchOptions.signal = controller.signal;

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    const isNetworkError = error.name === "TypeError" || error.message?.includes("fetch");
    const isTimeout = error.name === "AbortError";
    
    // Only retry safe, idempotent methods if retries are not disabled
    const isIdempotent = !fetchOptions.method || ["GET", "PUT", "DELETE", "HEAD"].includes(fetchOptions.method.toUpperCase());
    
    if ((isNetworkError || isTimeout) && isIdempotent && !skipRetry && retryCount < MAX_RETRIES) {
      console.warn(`Request failed (${error.name}). Retrying attempt ${retryCount + 1}/${MAX_RETRIES}...`);
      // Wait for a short duration with exponential backoff before retrying
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return fetchWithRetry(url, options, retryCount + 1);
    }

    if (isNetworkError) {
      throw new BackendOfflineError();
    }
    
    if (isTimeout) {
      throw new Error(`Request timed out after ${timeout}ms.`);
    }

    throw error;
  }
}

/**
 * Standard HTTP Request Handlers
 */
export const apiClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
    
    const response = await fetchWithRetry(url, options);
    
    if (!response.ok) {
      let errorDetail = "";
      try {
        const errJson = await response.json();
        errorDetail = errJson?.detail || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new ApiError(response.status, response.statusText, errorDetail);
    }
    
    // If 204 No Content, return empty object
    if (response.status === 204) {
      return {} as T;
    }
    
    return response.json() as Promise<T>;
  },

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put<T>(path: string, body: any, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(path, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return apiClient.request<T>(path, { ...options, method: "DELETE" });
  },
};
