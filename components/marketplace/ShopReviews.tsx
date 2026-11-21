"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "@/components/ui/ReviewForm";
import { StarRating } from "@/components/ui/StarRating";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { reviewsForShop } from "@/lib/reviews";
import type { Review } from "@/lib/types";
import { useRatingStats } from "@/components/providers/RatingStatsProvider";

export function ShopReviews({ shopSlug, shopName }: { shopSlug: string; shopName: string }) {
    const { user } = useAuth();
    const { refresh: refreshRatingStats } = useRatingStats();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState("");

    const loadReviews = useCallback(async () => {
        setError("");
        try { setReviews(await reviewsForShop(shopSlug)); }
        catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Shop reviews could not be loaded."); }
        finally { setLoading(false); }
    }, [shopSlug]);

    useEffect(() => { void loadReviews(); }, [loadReviews]);

    const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

    return <section className="oi-reviews-section" aria-labelledby="shop-reviews-title">
        <div className="oi-card-head">
            <h2 id="shop-reviews-title" className="oi-section-title">Shop reviews</h2>
            {reviews.length > 0 && <StarRating rating={average} reviews={reviews.length} />}
        </div>
        {loading ? <LoadingState label="Loading shop reviews" variant="inline" /> : error ? <p className="oi-form-error" role="alert">{error}</p> : reviews.length === 0 ? <p className="oi-muted">No reviews yet. Be the first to share your experience with {shopName}.</p> : <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
            {reviews.map(review => <article key={review.id} className="oi-review-card">
                <div className="oi-card-head"><b>{review.authorName}</b><small className="oi-muted">{new Date(review.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</small></div>
                <StarRating rating={review.rating} /><p style={{ marginTop: "var(--space-2)" }}>{review.text}</p>
            </article>)}
        </div>}
        {!showForm && (user ? <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>Rate this shop</Button> : <p className="oi-muted"><Link href={`/auth/login?next=${encodeURIComponent(`/shops/${shopSlug}`)}`} className="oi-link">Sign in</Link> to rate this shop.</p>)}
        {showForm && user && <div><ReviewForm targetType="shop" targetId={shopSlug} productSlug="" productName={shopName} authorName={user.name} onSubmit={async () => { await loadReviews(); void refreshRatingStats().catch(error => console.error("Rating totals could not be refreshed", error)); setShowForm(false); }} /><Button variant="ghost" size="sm" onClick={() => setShowForm(false)} style={{ marginTop: "var(--space-2)" }}>Cancel</Button></div>}
    </section>;
}
