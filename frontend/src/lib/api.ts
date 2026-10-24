/**
 * BrandGuard API Client Utility
 * Typed fetch requests for FastAPI backend endpoints.
 */

/**
 * Resolves and normalizes the base URL for backend API requests.
 * Strips trailing slashes and ensures the `/api` route prefix is always present,
 * regardless of whether NEXT_PUBLIC_API_URL is configured as:
 * - "https://your-service.onrender.com"
 * - "https://your-service.onrender.com/"
 * - "https://your-service.onrender.com/api"
 * - or defaults to local dev "http://localhost:8000/api".
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!envUrl) {
    return "http://localhost:8000/api";
  }
  const cleanUrl = envUrl.replace(/\/+$/, "");
  return cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
}

export const API_BASE_URL = getApiBaseUrl();

export interface Violation {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  flagged_text: string;
  citation: string;
  explanation: string;
  suggested_fix: string;
}

export interface AuditRequest {
  draft_text: string;
}

export interface AuditResponse {
  compliance_score: number;
  summary: string;
  violations: Violation[];
}

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  chroma_status: string;
}

export interface GuidelineUploadResponse {
  filename: string;
  chunks_indexed: number;
  total_chunks: number;
}

export interface GuidelineStatsResponse {
  total_chunks: number;
  status: string;
  sources?: string[];
}

export interface GuidelineResetResponse {
  message: string;
  total_chunks: number;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API Error (${status}): ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Generic typed fetch request handler for backend API calls.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (typeof errorJson?.detail === "string") {
        errorDetail = errorJson.detail;
      } else if (errorJson?.message) {
        errorDetail = errorJson.message;
      }
    } catch {
      // Non-JSON response body; fallback to status text
      if (response.statusText) {
        errorDetail = response.statusText;
      }
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json() as Promise<T>;
}

/**
 * Audit API services
 */
export const auditApi = {
  scan: (payload: AuditRequest, init?: RequestInit): Promise<AuditResponse> =>
    apiFetch<AuditResponse>("/audit/scan", {
      method: "POST",
      body: JSON.stringify(payload),
      ...init,
    }),
};

/**
 * Brand Guidelines API services
 */
export const guidelinesApi = {
  getStats: (init?: RequestInit): Promise<GuidelineStatsResponse> =>
    apiFetch<GuidelineStatsResponse>("/guidelines/stats", {
      method: "GET",
      ...init,
    }),

  upload: (
    file: File,
    init?: RequestInit
  ): Promise<GuidelineUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<GuidelineUploadResponse>("/guidelines/upload", {
      method: "POST",
      body: formData,
      ...init,
    });
  },

  reset: (init?: RequestInit): Promise<GuidelineResetResponse> =>
    apiFetch<GuidelineResetResponse>("/guidelines/reset", {
      method: "DELETE",
      ...init,
    }),

  deleteFile: (
    filename: string,
    init?: RequestInit
  ): Promise<GuidelineResetResponse> =>
    apiFetch<GuidelineResetResponse>(
      `/guidelines/file/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
        ...init,
      }
    ),
};

/**
 * Health API services
 *
 * Uses apiFetch so the base URL is driven by NEXT_PUBLIC_API_URL, not a
 * hardcoded localhost — prevents silent failures in staging / production.
 * The backend mounts /health at the root (not under /api), so the path
 * is constructed relative to the API base root.
 */
export const healthApi = {
  check: (init?: RequestInit): Promise<HealthResponse> =>
    apiFetch<HealthResponse>("/health", { method: "GET", ...init }),
};

