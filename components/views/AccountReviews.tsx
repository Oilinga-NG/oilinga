"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewForm } from "@/components/ui/ReviewForm";
import { Button } from "@/components/ui/Button";
import { AccountSidebarNav } from "@/components/auth/AccountSidebarNav";
import { useAuth } from "@/components/auth/AuthProvider";
import { readReviews, readReviewsForMyShop } from "@/lib/reviews";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import type { Review } from "@/lib/types";
import { useRatingStats } from "@/components/providers/RatingStatsProvider";
import { LoadingState } from "@/components/ui/LoadingState";

export function AccountReviews() {
    return (
        <Suspense fallback={<LoadingState label="Loading reviews" />}>
            <AccountReviewsInner />
        </Suspense>
    );
}

function AccountReviewsInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, ready } = useAuth();
    const { refresh: refreshRatingStats } = useRatingStats();
    const { products, loading: productsLoading } = useMarketplaceData();

    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewsError, setReviewsError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [selectedSlug, setSelectedSlug] = useState(
        () => searchParams.get("product") ?? "",
    );

    useEffect(() => {
        if (ready && !user) {
            router.replace("/auth/login?next=%2Faccount%2Freviews");
        }
    }, [ready, user, router]);

    useEffect(() => {
        if (!user) return;
        setReviewsError(null);
        const loadReviews = user.role === "seller" ? readReviewsForMyShop : readReviews;
        void loadReviews().then(setReviews).catch(error => {
            console.error("Reviews could not be loaded", error);
            setReviewsError(error instanceof Error ? error.message : "Reviews could not be loaded.");
        });
    }, [user?.id, user?.role]);

    // Pre-select product from query param
    useEffect(() => {
        const slug = searchParams.get("product");
        if (slug && user?.role !== "seller") {
            setSelectedSlug(slug);
            setShowForm(true);
        } else if (user?.role === "seller") {
            setSelectedSlug("");
            setShowForm(false);
        }
    }, [searchParams, user?.role]);

    if (!ready) {
        return <LoadingState label="Loading reviews" />;
    }

    if (!user) {
        return <LoadingState label="Redirecting to sign in" />;
    }

    async function refreshReviews() {
        if (!user) return;
        try {
            const loadReviews = user.role === "seller" ? readReviewsForMyShop : readReviews;
            setReviews(await loadReviews());
            setReviewsError(null);
        } catch (error) {
            console.error("Reviews could not be refreshed", error);
            setReviewsError(error instanceof Error ? error.message : "Reviews could not be refreshed.");
        }
        void refreshRatingStats().catch(error => console.error("Rating totals could not be refreshed", error));
        setShowForm(false);
        setSelectedSlug("");
    }

    const selectedProduct = products.find((p) => p.slug === selectedSlug);

    return (
        <section className="oi-view oi-container" aria-labelledby="reviews-title">
            <div className="oi-dashboard">
                <AccountSidebarNav />

                <div className="oi-dashboard__content">
                    <div className="oi-card-head">
                        <h1 id="reviews-title" className="oi-page-title">
                            {user.role === "seller" ? "Reviews for your shop and products" : "Your reviews"}
                        </h1>
                        {user.role !== "seller" && !showForm && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowForm(true)}
                            >
                                Write a review
                            </Button>
                        )}
                    </div>

                    {showForm && (
                        <div style={{ marginBottom: "var(--space-6)" }}>
                            <div className="oi-form-group">
                                <label htmlFor="review-product-select" className="oi-form-label">
                                    Select a product
                                </label>
                                <select
                                    id="review-product-select"
                                    className="oi-form-input"
                                    value={selectedSlug}
                                    onChange={(e) => setSelectedSlug(e.target.value)}
                                >
                                    <option value="">Choose a product…</option>
                                    {products.map((p) => (
                                        <option key={p.slug} value={p.slug}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedSlug && selectedProduct && (
                                <ReviewForm
                                    productSlug={selectedProduct.slug}
                                    productName={selectedProduct.name}
                                    authorName={user.name}
                                    onSubmit={refreshReviews}
                                />
                            )}

                            {productsLoading && <LoadingState label="Loading published products" variant="inline" />}
                            {!productsLoading && products.length === 0 && <p className="oi-muted">There are no published products to review yet.</p>}
                            {!selectedSlug && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowForm(false);
                                        setSelectedSlug("");
                                    }}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    )}

                    {reviewsError && <p className="oi-form-error" role="alert">{reviewsError}</p>}

                    {reviews.length === 0 && !showForm ? (
                        <div className="oi-wishlist-empty">
                            <p className="oi-muted">
                                {user.role === "seller" ? "There are no reviews for your shop or products yet." : "You haven't written any reviews yet."}
                            </p>
                            {user.role !== "seller" && <ButtonLink href="/marketplace" variant="outline" size="sm">Browse products</ButtonLink>}
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: "var(--space-3)" }}>
                            {reviews.map((review) => (
                                <article key={review.id} className="oi-review-card">
                                    <div className="oi-card-head">
                                        <Link
                                            href={review.targetType === "shop" ? `/shops/${review.targetId ?? review.productSlug}` : `/products/${review.targetId ?? review.productSlug}`}
                                            className="oi-link"
                                        >
                                            {review.targetType === "shop" ? `Shop: ${review.productName}` : review.productName}
                                        </Link>
                                        <small className="oi-muted">
                                            {new Date(review.date).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </small>
                                    </div>
                                    <StarRating rating={review.rating} />
                                    <p style={{ marginTop: "var(--space-2)" }}>{review.text}</p>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
