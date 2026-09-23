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

// Temporary thin client: KYC admin paths fixed. Full client is re-exported from api-full via build.
// To avoid breaking the app, we re-export auth helpers and implement KYC + passthrough stubs.

export type Result<T> = { data: T } | { error: ApiError };

function getApiBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_API_URL environment variable is not set.");
    }
    return "http://localhost:3001";
  }
  return apiUrl;
}

const API_BASE_URL = getApiBaseUrl();

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<Result<T>> {
  let token: string | undefined;
  try {
    token = getToken();
  } catch (err) {
    return { error: err as ApiError };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.headers) Object.assign(headers, options.headers as Record<string, string>);
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
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
    return { data: (await response.json()) as T };
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

// Re-export auth helpers used across the app
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
};

export { ApiError };

// Preserve module shape: other api.* namespaces are loaded from the full client
// if present at runtime via optional dynamic import (see api-compat).
export type AuthSignupRequest = {
  business_name: string;
  email: string;
  password: string;
  phone_number: string;
  country: string;
  settlement_currency: string;
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  bank_code?: string;
};
export type AuthLoginRequest = { email: string; password: string };
