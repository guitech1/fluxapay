import { handleSessionExpired } from "./session";
import { ApiError } from "./errors";
import {
  getToken,
  storeToken,
  clearToken,
  getRefreshToken,
  storeRefreshToken,
  clearRefreshToken,
  isAdmin,
  setAdminStatus,
  clearAuth,
} from "./auth";

// NOTE: full file restored with KYC path fixes - truncated intermediate state was accidental
export type Result<T> = { data: T } | { error: ApiError };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<Result<T>> {
  let token: string | null = null;
  try {
    token = getToken();
  } catch (err) {
    return { error: err as ApiError };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.headers) Object.assign(headers, options.headers);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) handleSessionExpired();
      const body = await response.json().catch(() => ({ message: "Request failed" }));
      return {
        error: new ApiError(
          response.status,
          (body as { message?: string }).message || "Request failed",
        ),
      };
    }
    const data = (await response.json()) as T;
    return { data };
  } catch (err) {
    return {
      error: new ApiError(0, err instanceof Error ? err.message : "Network error"),
    };
  }
}

export const api = {
  adminKyc: {
    list: (params?: { status?: string; page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      return fetchWithAuth<Record<string, unknown>>(
        `/api/v1/merchants/kyc/admin/submissions?${qs.toString()}`,
      );
    },
    getByMerchant: (merchantId: string) =>
      fetchWithAuth<Record<string, unknown>>(
        `/api/v1/merchants/kyc/admin/${merchantId}`,
      ),
    updateStatus: (
      merchantId: string,
      body: { status: string; rejection_reason?: string },
    ) =>
      fetchWithAuth<Record<string, unknown>>(
        `/api/v1/merchants/kyc/admin/${merchantId}/status`,
        { method: "PATCH", body: JSON.stringify(body) },
      ),
  },
  kyc: {
    admin: {
      getSubmissions: (params?: {
        status?: string;
        page?: number;
        limit?: number;
      }) => {
        const sp = new URLSearchParams();
        if (params?.status) sp.set("status", params.status);
        if (params?.page != null) sp.set("page", String(params.page));
        if (params?.limit != null) sp.set("limit", String(params.limit));
        return fetchWithAuth<Record<string, unknown>>(
          `/api/v1/merchants/kyc/admin/submissions?${sp.toString()}`,
        );
      },
      getByMerchantId: (merchantId: string) =>
        fetchWithAuth<Record<string, unknown>>(
          `/api/v1/merchants/kyc/admin/${merchantId}`,
        ),
      updateStatus: (
        merchantId: string,
        body: { status: string; rejection_reason?: string },
      ) =>
        fetchWithAuth<Record<string, unknown>>(
          `/api/v1/merchants/kyc/admin/${merchantId}/status`,
          { method: "PATCH", body: JSON.stringify(body) },
        ),
      bulkReject: (merchantIds: string[], reason: string, notes?: string) =>
        fetchWithAuth<Record<string, unknown>>(
          "/api/v1/merchants/kyc/admin/bulk-reject",
          {
            method: "POST",
            body: JSON.stringify({ merchantIds, reason, notes }),
          },
        ),
      bulkRequestInfo: (merchantIds: string[], message: string) =>
        fetchWithAuth<Record<string, unknown>>(
          "/api/v1/merchants/kyc/admin/bulk-request-info",
          {
            method: "POST",
            body: JSON.stringify({ merchantIds, message }),
          },
        ),
    },
  },
};

export {
  getToken,
  storeToken,
  clearToken,
  getRefreshToken,
  storeRefreshToken,
  clearRefreshToken,
  isAdmin,
  setAdminStatus,
  clearAuth,
} from "./auth";

export { ApiError } from "./errors";
