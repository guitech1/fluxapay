"use client";

import React, { useState, JSX } from "react";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  X,
  Eye,
  Filter,
  FileText,
  Calendar,
  Shield,
  User,
  Globe,
  Trash2,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { toastApiError } from "@/lib/toastApiError";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import BulkRejectModal from "@/features/admin/kyc/BulkRejectModal";
import BulkApproveModal from "@/features/admin/kyc/BulkApproveModal";
import BulkRequestInfoModal from "@/features/admin/kyc/BulkRequestInfoModal";
import {
  useKycSubmissions,
  useKycDetails,
  type KycApplicationShape,
} from "@/hooks/useKycSubmissions";

interface StatusConfig {
  color: string;
  bg: string;
  border: string;
  icon: JSX.Element;
  label: string;
}

const AdminKycPage = () => {
  const primaryColor = "oklch(0.205 0 0)";
  const primaryLight = "oklch(0.93 0 0)";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [showBulkRequestInfoModal, setShowBulkRequestInfoModal] = useState(false);

  const { applications, isLoading, mutate } = useKycSubmissions({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 100,
  });
  const { application: selectedApplication } =
    useKycDetails(selectedMerchantId);

  const getStatusConfig = (
    status: KycApplicationShape["status"],
  ): StatusConfig => {
    switch (status) {
      case "approved":
        return {
          color: "text-emerald-700",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          icon: <CheckCircle className="w-3 h-3" />,
          label: "Approved",
        };
      case "pending":
        return {
          color: "text-amber-700",
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: <Shield className="w-3 h-3" />,
          label: "Pending Review",
        };
      case "rejected":
        return {
          color: "text-rose-700",
          bg: "bg-rose-50",
          border: "border-rose-200",
          icon: <X className="w-3 h-3" />,
          label: "Rejected",
        };
      case "additional_info_required":
        return {
          color: "text-blue-700",
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: <AlertTriangle className="w-3 h-3" />,
          label: "Add. Info Required",
        };
      default:
        return {
          color: "text-slate-600",
          bg: "bg-slate-50",
          border: "border-slate-200",
          icon: <Shield className="w-3 h-3" />,
          label: status,
        };
    }
  };

  const handleUpdateStatus = async (
    merchantId: string,
    newStatus: "approved" | "rejected" | "additional_info_required",
    rejection_reason?: string,
  ) => {
    try {
      const result = await api.kyc.admin.updateStatus(merchantId, {
        status: newStatus,
        rejection_reason,
      });
      if ("error" in result && result.error) {
        toastApiError(result.error);
        return;
      }
      toast.success(`Application ${newStatus} successfully`);
      setSelectedMerchantId(null);
      setShowRejectModal(false);
      setRejectionReason("");
      void mutate();
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleReject = () => {
    if (!selectedApplication) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    void handleUpdateStatus(
      selectedApplication.merchantId,
      "rejected",
      rejectionReason,
    );
  };

  const handleBulkApprove = async () => {
    const merchantIds = Array.from(selectedRows);
    if (merchantIds.length === 0) return { succeeded: 0, failed: [] };
    try {
      const results = await Promise.all(
        merchantIds.map((id) =>
          api.kyc.admin.updateStatus(id, { status: "approved" }),
        ),
      );
      const failed: { id: string; error?: string }[] = [];
      let succeeded = 0;
      results.forEach((result, idx) => {
        if ("error" in result && result.error) {
          failed.push({
            id: merchantIds[idx],
            error: result.error.message || "Failed to approve",
          });
        } else {
          succeeded += 1;
        }
      });
      if (succeeded > 0) {
        toast.success(`${succeeded} applications approved`);
      }
      if (failed.length > 0) {
        toastApiError(new Error(`${failed.length} failed to approve`));
      }
      setSelectedRows(new Set());
      setShowBulkApproveModal(false);
      void mutate();
      return { succeeded, failed };
    } catch (err) {
      toastApiError(err);
      return {
        succeeded: 0,
        failed: merchantIds.map((id) => ({ id, error: "Failed" })),
      };
    }
  };

  const handleBulkReject = async (reason: string, notes: string) => {
    const merchantIds = Array.from(selectedRows);
    if (merchantIds.length === 0) return { succeeded: 0, failed: [] };
    try {
      const result = await api.kyc.admin.bulkReject(merchantIds, reason, notes);
      if ("error" in result && result.error) {
        toastApiError(result.error);
        return {
          succeeded: 0,
          failed: merchantIds.map((id) => ({
            id,
            error: result.error.message || "Failed",
          })),
        };
      }
      toast.success(`${merchantIds.length} applications rejected`);
      setSelectedRows(new Set());
      setShowBulkRejectModal(false);
      void mutate();
      return { succeeded: merchantIds.length, failed: [] };
    } catch (err) {
      toastApiError(err);
      return {
        succeeded: 0,
        failed: merchantIds.map((id) => ({ id, error: "Failed" })),
      };
    }
  };

  const handleBulkRequestInfo = async (message: string) => {
    const merchantIds = Array.from(selectedRows);
    if (merchantIds.length === 0) return { succeeded: 0, failed: [] };
    try {
      const result = await api.kyc.admin.bulkRequestInfo(merchantIds, message);
      if ("error" in result && result.error) {
        toastApiError(result.error);
        return {
          succeeded: 0,
          failed: merchantIds.map((id) => ({
            id,
            error: result.error.message || "Failed",
          })),
        };
      }
      toast.success(`Requested info from ${merchantIds.length} merchants`);
      setSelectedRows(new Set());
      setShowBulkRequestInfoModal(false);
      void mutate();
      return { succeeded: merchantIds.length, failed: [] };
    } catch (err) {
      toastApiError(err);
      return {
        succeeded: 0,
        failed: merchantIds.map((id) => ({ id, error: "Failed" })),
      };
    }
  };

  const toggleRowSelection = (merchantId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(merchantId)) {
      newSelected.delete(merchantId);
    } else {
      newSelected.add(merchantId);
    }
    setSelectedRows(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredApplications.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredApplications.map((a) => a.merchantId)));
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      !searchTerm ||
      app.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStats = () => {
    const total = applications.length;
    const pending = applications.filter((a) => a.status === "pending").length;
    const approved = applications.filter((a) => a.status === "approved").length;
    const rejected = applications.filter((a) => a.status === "rejected").length;
    return { total, pending, approved, rejected };
  };

  const stats = getStats();

  if (isLoading && applications.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading KYC applications...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                KYC Applications
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Review and manage merchant identity verification requests
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Pending Review
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.pending}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Approved</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.approved}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Rejected</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.rejected}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-rose-50">
                <X className="w-5 h-5 text-rose-600" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Total Applications
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-100">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by merchant, email..."
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent transition-shadow"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="additional_info_required">
                  Add. Info Required
                </option>
              </select>
            </div>
          </div>
        </div>

        {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">
              {selectedRows.size} application
              {selectedRows.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkApproveModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setShowBulkRequestInfoModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Request Info
              </button>
              <button
                type="button"
                onClick={() => setShowBulkRejectModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.size === filteredApplications.length &&
                        filteredApplications.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Reference ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Merchant Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Date Submitted
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredApplications.length === 0 ? (
                  <EmptyState
                    colSpan={6}
                    className="py-12"
                    message="No applications found. No KYC applications match your search criteria."
                  />
                ) : (
                  filteredApplications.map((app) => {
                    const statusConfig = getStatusConfig(app.status);
                    const isSelected = selectedRows.has(app.merchantId);
                    return (
                      <tr
                        key={app.id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(app.merchantId)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-900 font-mono">
                            {app.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100">
                              <User className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {app.merchantName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Globe className="w-3 h-3 text-slate-400" />
                                <p className="text-xs text-slate-500">
                                  {app.country}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {app.submittedDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              statusConfig.bg
                            } ${statusConfig.color} ${statusConfig.border}`}
                          >
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedMerchantId(app.merchantId)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
                          >
                            <Eye className="w-4 h-4" />
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Review application
              </h2>
              <button
                type="button"
                onClick={() => setSelectedMerchantId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500">Merchant</p>
                <p className="font-medium text-slate-900">
                  {selectedApplication.merchantName}
                </p>
                <p className="text-sm text-slate-600">{selectedApplication.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleUpdateStatus(
                      selectedApplication.merchantId,
                      "approved",
                    )
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleUpdateStatus(
                      selectedApplication.merchantId,
                      "additional_info_required",
                    )
                  }
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  Request info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedApplication && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Reject application
            </h3>
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 text-sm"
              rows={4}
              placeholder="Rejection reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-2 text-sm text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg"
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkApproveModal
        open={showBulkApproveModal}
        onClose={() => setShowBulkApproveModal(false)}
        onConfirm={handleBulkApprove}
        count={selectedRows.size}
      />
      <BulkRejectModal
        open={showBulkRejectModal}
        onClose={() => setShowBulkRejectModal(false)}
        onConfirm={handleBulkReject}
        count={selectedRows.size}
      />
      <BulkRequestInfoModal
        open={showBulkRequestInfoModal}
        onClose={() => setShowBulkRequestInfoModal(false)}
        onConfirm={handleBulkRequestInfo}
        count={selectedRows.size}
      />
    </div>
  );
};

export default AdminKycPage;
