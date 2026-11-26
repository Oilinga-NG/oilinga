"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Plan } from "@/lib/subscription";

export function useSubscriptionPlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const data = await apiFetch<unknown>("/subscriptions/plans");
                if (!cancelled) setPlans(Array.isArray(data) ? data as Plan[] : []);
            } catch (fetchError) {
                if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Could not load plans.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { plans, loading, error };
}

/** The authenticated seller's current plan id, read from the backend shop record. */
export function useCurrentPlanId(enabled: boolean) {
    const [planId, setPlanId] = useState<string | null>(null);
    const [loading, setLoading] = useState(enabled);

    useEffect(() => {
        if (!enabled) {
            setPlanId(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void (async () => {
            try {
                const data = await apiFetch<{ plan?: unknown }>("/subscriptions");
                if (!cancelled) setPlanId(typeof data.plan === "string" ? data.plan : null);
            } catch {
                if (!cancelled) setPlanId(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [enabled]);

    return { planId, loading };
}
