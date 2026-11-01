"use client";

import React, { useState, useEffect } from "react";
import { Star, CheckCircle, MessageSquare, ThumbsUp, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ProductReview } from "@/types/auth";
import { getProductReviewsFromDb, submitProductReviewInDb } from "@/lib/firebase/firestore";

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
}

export default function ProductReviewsSection({
  productId,
  productName,
}: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Form states
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadReviews() {
      try {
        setLoading(true);
        const data = await getProductReviewsFromDb(productId, "approved");
        setReviews(data);
      } catch (err) {
        console.warn("Failed to load reviews:", err);
      } finally {
        setLoading(false);
      }
    }
    if (productId) {
      loadReviews();
    }
  }, [productId]);

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / totalReviews).toFixed(1)
      : "0.0";

  // Rating distribution counts
  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percentage:
      totalReviews > 0
        ? Math.round((reviews.filter((r) => r.rating === star).length / totalReviews) * 100)
        : 0,
  }));

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !comment.trim()) {
      toast.error("Please provide your name and a brief review message.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitProductReviewInDb({
        productId,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || "",
        reviewText: comment.trim(),
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        isVerifiedPurchase: false,
      });

      if (res.success) {
        toast.success("Thank you! Your review has been submitted for moderation.");
        setAuthorName("");
        setAuthorEmail("");
        setTitle("");
        setComment("");
        setRating(5);
        setShowReviewForm(false);
      } else {
        toast.error(res.error || "Failed to submit review. Please try again.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-16 pt-12 border-t border-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">
            <Star size={13} className="fill-amber-400 text-amber-500" />
            Customer Ratings &amp; Reviews
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Verified Feedback for {productName}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Genuine experiences from manufacturing labs, formulators, and wholesale purchasers.
          </p>
        </div>

        <Button
          onClick={() => setShowReviewForm(!showReviewForm)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl px-6 py-5 text-xs shadow-md"
        >
          <MessageSquare size={16} className="mr-2" />
          {showReviewForm ? "Close Review Form" : "Write a Customer Review"}
        </Button>
      </div>

      {/* Review Form Drawer / Card */}
      {showReviewForm && (
        <form
          onSubmit={handleSubmitReview}
          className="mb-12 p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Share Your Experience with {productName}
          </h3>

          <div>
            <Label className="text-xs font-bold text-slate-700">Overall Rating</Label>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    size={28}
                    className={`transition-colors ${
                      (hoverRating || rating) >= star
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-semibold text-slate-500 ml-2">
                {rating === 5
                  ? "5 / 5 (Excellent Quality)"
                  : rating === 4
                  ? "4 / 5 (Very Good)"
                  : rating === 3
                  ? "3 / 5 (Average)"
                  : rating === 2
                  ? "2 / 5 (Below Expectation)"
                  : "1 / 5 (Poor)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Your Full Name / Company <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Dr. Emeka Eze / Crown Cosmetics"
                className="h-11 rounded-xl bg-white text-xs border-slate-200"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Email Address (Optional)</Label>
              <Input
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="e.g. emeka@crowncosmetics.ng"
                className="h-11 rounded-xl bg-white text-xs border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Review Headline</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Superior purity and excellent batch consistency"
              className="h-11 rounded-xl bg-white text-xs border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Detailed Feedback <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Describe your formulation results, packaging quality, delivery speed, or chemical grade..."
              className="rounded-xl bg-white text-xs border-slate-200"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReviewForm(false)}
              className="rounded-xl text-xs h-10 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs h-10 px-5 gap-2"
            >
              <Send size={14} />
              {submitting ? "Submitting..." : "Submit Review for Verification"}
            </Button>
          </div>
        </form>
      )}

      {/* Ratings Overview Bar & Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="text-5xl font-black text-slate-900 tracking-tight">{averageRating}</div>
          <div className="flex items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={18}
                className={
                  parseFloat(averageRating) >= s
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-300"
                }
              />
            ))}
          </div>
          <p className="text-xs font-medium text-slate-500">
            Based on {totalReviews} approved {totalReviews === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="md:col-span-8 flex flex-col justify-center space-y-2.5">
          {starCounts.map((item) => (
            <div key={item.star} className="flex items-center gap-3 text-xs">
              <span className="w-12 font-bold text-slate-600 flex items-center gap-1">
                {item.star} <Star size={12} className="text-amber-400 fill-amber-400" />
              </span>
              <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <span className="w-10 text-right font-medium text-slate-400 text-[11px]">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews Feed */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-8">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 mb-1">No reviews yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Be the first to leave a review for {productName} and help formulators across Nigeria!
          </p>
          <Button
            size="sm"
            onClick={() => setShowReviewForm(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold"
          >
            Leave First Review
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{rev.authorName}</span>
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle size={10} />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={13}
                        className={
                          rev.rating >= s
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-200 fill-slate-100"
                        }
                      />
                    ))}
                    <span className="text-[11px] text-slate-400 ml-2">
                      {new Date(rev.createdAt).toLocaleDateString("en-NG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {rev.title && (
                <h5 className="text-xs font-bold text-slate-800">{rev.title}</h5>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
