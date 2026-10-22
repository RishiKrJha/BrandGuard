/**
 * BrandGuard API Client Utility
 * Typed fetch requests for FastAPI backend endpoints.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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
};

/**
 * Health API services
 */
export const healthApi = {
  check: (init?: RequestInit): Promise<HealthResponse> =>
    // Backend health endpoint is mounted at root /health or /api/health
    fetch("http://localhost:8000/health", init)
      .then((res) => res.json() as Promise<HealthResponse>)
      .catch(() =>
        apiFetch<HealthResponse>("/health", { method: "GET", ...init })
      ),
};

