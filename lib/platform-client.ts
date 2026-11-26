"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface PlatformStats {
    buyers: number;
    verifiedSellers: number;
    activeProducts: number;
    deliveredOrders: number;
    successfulPayments: number;
    totalTraded: number;
}

const EMPTY_STATS: PlatformStats = {
    buyers: 0,
    verifiedSellers: 0,
    activeProducts: 0,
    deliveredOrders: 0,
    successfulPayments: 0,
    totalTraded: 0
};

export function usePlatformStats() {
    const [stats, setStats] = useState<PlatformStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const data = await apiFetch<Partial<PlatformStats>>("/platform/stats");
                if (!cancelled) setStats({ ...EMPTY_STATS, ...data });
            } catch {
                // Live views show zero rather than fabricated figures when the API is unavailable.
                if (!cancelled) setStats(EMPTY_STATS);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { stats, loading };
}

export function formatCount(value: number) {
    return new Intl.NumberFormat("en-NG").format(value);
}

export function formatNairaCompact(value: number) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value);
}
