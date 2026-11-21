"use client";

import { StarRating } from "@/components/ui/StarRating";
import { useRatingStats, type RatingStat } from "@/components/providers/RatingStatsProvider";

export function LiveRating({ targetType, targetId, fallback, className }: {
    targetType: "product" | "shop";
    targetId: string;
    fallback: RatingStat;
    className?: string;
}) {
    const stats = useRatingStats();
    const current = (targetType === "shop" ? stats.shops : stats.products)[targetId];
    const rating = current?.reviews ? current : fallback;
    return <StarRating rating={rating.rating} reviews={rating.reviews} className={className} />;
}

export function LiveRatingSummary({ targetType, targetId, fallback }: {
    targetType: "product" | "shop";
    targetId: string;
    fallback: RatingStat;
}) {
    const stats = useRatingStats();
    const current = (targetType === "shop" ? stats.shops : stats.products)[targetId];
    const rating = current?.reviews ? current : fallback;
    return <><strong>{rating.reviews ? rating.rating.toFixed(1) : "—"}</strong><small>{rating.reviews} {rating.reviews === 1 ? "Review" : "Reviews"}</small></>;
}
