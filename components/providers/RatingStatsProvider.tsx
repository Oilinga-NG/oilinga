"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";

export type RatingStat = { rating: number; reviews: number };
type RatingStats = { products: Record<string, RatingStat>; shops: Record<string, RatingStat> };
interface RatingStatsContextValue extends RatingStats { refresh: () => Promise<void>; }
const emptyStats: RatingStats = { products: {}, shops: {} };
const RatingStatsContext = createContext<RatingStatsContextValue>({ ...emptyStats, refresh: async () => {} });

export function RatingStatsProvider({ children }: { children: ReactNode }) {
    const [stats, setStats] = useState<RatingStats>(emptyStats);
    const refresh = useCallback(async () => {
        const result = await apiFetch<RatingStats>("/reviews/stats", { cache: "no-store" });
        setStats(result);
    }, []);
    useEffect(() => { void refresh().catch(error => console.error("Ratings could not be loaded", error)); }, [refresh]);
    const value = useMemo(() => ({ ...stats, refresh }), [stats, refresh]);
    return <RatingStatsContext.Provider value={value}>{children}</RatingStatsContext.Provider>;
}

export function useRatingStats() { return useContext(RatingStatsContext); }
