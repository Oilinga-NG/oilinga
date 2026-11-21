import type { Review } from "./types";
import { apiFetch } from "@/lib/api-client";
import { mapReview } from "@/lib/backend-mappers";

export async function readReviews(): Promise<Review[]> {
    return (await apiFetch<Record<string, unknown>[]>("/reviews?mine=true")).map(mapReview);
}

export async function readReviewsForMyShop(): Promise<Review[]> {
    return (await apiFetch<Record<string, unknown>[]>("/reviews?myShop=true")).map(mapReview);
}

export async function reviewsForProduct(slug: string): Promise<Review[]> {
    return (await apiFetch<Record<string, unknown>[]>(`/reviews?targetType=PRODUCT&targetId=${encodeURIComponent(slug)}`)).map(mapReview);
}

export async function reviewsForShop(slug: string): Promise<Review[]> {
    return (await apiFetch<Record<string, unknown>[]>(`/reviews?targetType=SHOP&targetId=${encodeURIComponent(slug)}`)).map(mapReview);
}

export async function writeReview(review: Review): Promise<Review> {
    const result = await apiFetch<Record<string, unknown>>("/reviews", { method: "POST", body: JSON.stringify({ targetType: review.targetType === "shop" ? "SHOP" : "PRODUCT", targetId: review.targetId ?? review.productSlug, rating: review.rating, text: review.text }) });
    return mapReview(result) as Review;
}
