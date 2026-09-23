"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { Result } from "@/lib/api";
import { ApiError } from "@/lib/errors";

/** Normalized shape for admin KYC list and detail (matches KycApplication where possible). */
export interface KycApplicationShape {
  id: string;
  merchantId: string;
  merchantName: string;
  email: string;
  country: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected" | "additional_info_required";
  documents: { type: string; name: string; url: string; status: "verified" | "pending" | "rejected" }[];
  businessInfo: { registrationNumber: string; address: string; type: string };
  beneficialOwners: { name: string; role: string; ownership: number }[];
}

interface BackendSubmission {
  id: string;
  merchantId: string;
  kyc_status: string;
  created_at: string;
  merchant?: { id: string; business_name: string; email: string; country: string };
  documents?: Array<{ document_type: string; file_name: string; file_url?: string }>;
  legal_business_name?: string;
  business_registration_number?: string;
  business_address?: string;
  business_type?: string;
  director_full_name?: string;
}

/** UI filter status → backend KYCStatus enum */
function mapStatusToBackend(status?: string): string | undefined {
  if (!status || status === "all") return undefined;
  if (status === "pending") return "pending_review";
  return status;
}

function mapStatus(s: string): KycApplicationShape["status"] {
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "pending_review") return "pending";
  return "additional_info_required";
}

function mapSubmission(raw: BackendSubmission): KycApplicationShape {
  const docs = (raw.documents ?? []).map((d) => ({
    type: d.document_type ?? "",
    name: d.file_name ?? "",
    url: d.file_url ?? "#",
    status: "pending" as const,
  }));
  return {
    id: raw.merchantId ?? raw.id,
    merchantId: raw.merchantId,
    merchantName: raw.merchant?.business_name ?? "",
    email: raw.merchant?.email ?? "",
    country: raw.merchant?.country ?? "",
    submittedDate: raw.created_at?.slice(0, 10) ?? "",
    status: mapStatus(raw.kyc_status),
    documents: docs,
    businessInfo: {
      registrationNumber: raw.business_registration_number ?? "",
      address: raw.business_address ?? "",
      type: raw.business_type ?? "",
    },
    beneficialOwners: raw.director_full_name
      ? [{ name: raw.director_full_name, role: "Director", ownership: 100 }]
      : [],
  };
}

interface KycSubmissionsResponse {
  submissions: BackendSubmission[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface UseKycSubmissionsParams {
  status?: string;
  page?: number;
  limit?: number;
}

function unwrapResult<T>(result: Result<T>): T {
  if ("error" in result && result.error) {
    throw result.error instanceof ApiError
      ? result.error
      : new ApiError(500, String(result.error));
  }
  return (result as { data: T }).data;
}

export function useKycSubmissions(params: UseKycSubmissionsParams = {}) {
  const backendParams = {
    ...params,
    status: mapStatusToBackend(params.status),
  };

  const key =
    params.status || params.page != null || params.limit != null
      ? ["kyc-submissions", backendParams]
      : "kyc-submissions";

  const { data, error, isLoading, mutate } = useSWR<KycSubmissionsResponse>(
    key,
    async () => {
      const result = await api.kyc.admin.getSubmissions(backendParams);
      return unwrapResult(result as Result<KycSubmissionsResponse>);
    }
  );

  const applications: KycApplicationShape[] = (data?.submissions ?? []).map(mapSubmission);

  return {
    applications,
    pagination: data?.pagination,
    error,
    isLoading,
    mutate,
  };
}

export function useKycDetails(merchantId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    merchantId ? ["kyc-details", merchantId] : null,
    async () => {
      const result = await api.kyc.admin.getByMerchantId(merchantId!);
      return unwrapResult(
        result as Result<{ kyc: BackendSubmission & { merchant?: BackendSubmission["merchant"] } }>
      );
    }
  );
  const application: KycApplicationShape | null = data?.kyc
    ? mapSubmission({
        ...data.kyc,
        merchantId: data.kyc.merchantId ?? merchantId!,
        merchant: data.kyc.merchant as BackendSubmission["merchant"],
        documents: data.kyc.documents,
        created_at: data.kyc.created_at,
        kyc_status: data.kyc.kyc_status,
        legal_business_name: data.kyc.legal_business_name,
        business_registration_number: data.kyc.business_registration_number,
        business_address: data.kyc.business_address,
        business_type: data.kyc.business_type,
        director_full_name: data.kyc.director_full_name,
      } as BackendSubmission)
    : null;
  return { application, error, isLoading, mutate };
}
