"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProductReviewsFromDb,
  updateReviewStatusInDb,
  deleteReviewFromDb,
  getProductsFromDb,
} from "@/lib/firebase/firestore";
import { ProductReview, Product } from "@/types/auth";
import {
  Star,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ProductReviewsManagementPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedReviews, fetchedProducts] = await Promise.all([
        getProductReviewsFromDb(),
        getProductsFromDb(),
      ]);
      setReviews(fetchedReviews);
      setProducts(fetchedProducts);
    } catch (err: any) {
      console.error("Error loading reviews:", err);
      toast.error("Failed to load product reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (
    reviewId: string,
    newStatus: "approved" | "rejected",
    productId?: string
  ) => {
    try {
      setProcessingId(reviewId);
      const res = await updateReviewStatusInDb(reviewId, newStatus, productId);
      if (!res.success) {
        toast.error(res.error || "Failed to update review status.");
        return;
      }
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: newStatus } : r))
      );
      toast.success(
        newStatus === "approved" ? "Review approved & published!" : "Review rejected."
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to update review.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this customer review?")) {
      return;
    }
    try {
      setProcessingId(reviewId);
      const res = await deleteReviewFromDb(reviewId);
      if (!res.success) {
        toast.error(res.error || "Failed to delete review.");
        return;
      }
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      toast.success("Review deleted successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete review.");
    } finally {
      setProcessingId(null);
    }
  };

  // Filter reviews
  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.authorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.authorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reviewText?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesProduct = productFilter === "all" || r.productId === productFilter;

    return matchesSearch && matchesStatus && matchesProduct;
  });

  // Calculate metrics
  const totalCount = reviews.length;
  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  const approvedCount = reviews.filter((r) => r.status === "approved").length;
  const avgRating =
    approvedCount > 0
      ? (
          reviews
            .filter((r) => r.status === "approved")
            .reduce((sum, r) => sum + r.rating, 0) / approvedCount
        ).toFixed(1)
      : "5.0";

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Product Reviews &amp; Ratings
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
              Moderation
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review, approve, and moderate customer product feedback and verified purchase ratings.
          </p>
        </div>

        <Button
          onClick={loadData}
          variant="outline"
          size="sm"
          className="rounded-xl flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Reviews</span>
            <MessageSquare size={16} className="text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Submitted by buyers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Pending Moderation</span>
            <AlertCircle size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">{pendingCount}</p>
          <p className="text-[11px] text-amber-600/80 mt-1">Requires review approval</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Approved &amp; Live</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">{approvedCount}</p>
          <p className="text-[11px] text-emerald-600/80 mt-1">Visible on storefront</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Average Rating</span>
            <Star size={16} className="text-amber-400 fill-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{avgRating} / 5.0</p>
          <p className="text-[11px] text-slate-400 mt-1">Across approved reviews</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by customer, product, or review text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs sm:text-sm bg-slate-50/50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending ({pendingCount})</option>
            <option value="approved">Approved ({approvedCount})</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Product Filter */}
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-orange-500 max-w-[180px] truncate"
          >
            <option value="all">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reviews Table / Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="animate-spin text-orange-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading customer reviews from database...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-20 text-center">
            <MessageSquare size={36} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No reviews found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {reviews.length === 0
                ? "Customers haven't submitted any product reviews yet. Reviews submitted from the shop will appear here for your moderation."
                : "No reviews match your current search and filter criteria."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredReviews.map((rev) => (
              <div key={rev.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Rating stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={15}
                          className={
                            star <= rev.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-200"
                          }
                        />
                      ))}
                    </div>

                    <span className="font-bold text-slate-900 text-sm">{rev.authorName}</span>
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={11} /> Verified Buyer
                      </span>
                    )}

                    <span className="text-xs text-slate-400">&bull;</span>
                    <span className="text-xs font-semibold text-slate-600">
                      Product: <strong className="text-orange-950">{rev.productName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    {rev.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Approved
                      </span>
                    ) : rev.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        <XCircle size={12} /> Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        <AlertCircle size={12} /> Pending Review
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Review Body */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  &ldquo;{rev.reviewText}&rdquo;
                </p>

                {/* Moderation Controls */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Reviewer Contact: <span className="font-mono">{rev.authorEmail}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {rev.status !== "approved" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(rev.id, "approved", rev.productId)}
                        disabled={processingId === rev.id}
                        className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold"
                      >
                        <CheckCircle2 size={13} />
                        Approve &amp; Publish
                      </Button>
                    )}

                    {rev.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(rev.id, "rejected", rev.productId)}
                        disabled={processingId === rev.id}
                        className="h-8 rounded-xl border-slate-300 text-slate-700 hover:text-rose-600 text-xs gap-1.5 font-medium"
                      >
                        <XCircle size={13} />
                        Reject
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(rev.id)}
                      disabled={processingId === rev.id}
                      className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Permanently Delete Review"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

