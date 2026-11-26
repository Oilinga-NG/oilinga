import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlatformStats } from "@/lib/platform-client";
import { useCurrentPlanId, useSubscriptionPlans } from "@/lib/subscription-client";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiFetch }));

beforeEach(() => {
    apiFetch.mockReset();
});

describe("backend-backed view data", () => {
    it("loads the subscription plan catalogue from the backend", async () => {
        const plans = [{ id: "growth", name: "Growth", monthlyPrice: 9900, annualPrice: 8250, commission: 2.5, listingLimit: 50, featured: true, features: [], tagline: "" }];
        apiFetch.mockResolvedValueOnce(plans);

        const { result } = renderHook(() => useSubscriptionPlans());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(apiFetch).toHaveBeenCalledWith("/subscriptions/plans");
        expect(result.current.plans).toEqual(plans);
        expect(result.current.error).toBeNull();
    });

    it("reads the current plan from the backend instead of assuming Starter", async () => {
        apiFetch.mockResolvedValueOnce({ plan: "pro", subscriptionStatus: "Active" });

        const { result } = renderHook(() => useCurrentPlanId(true));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(apiFetch).toHaveBeenCalledWith("/subscriptions");
        expect(result.current.planId).toBe("pro");
    });

    it("loads public platform statistics from the backend", async () => {
        apiFetch.mockResolvedValueOnce({
            buyers: 42,
            verifiedSellers: 6,
            activeProducts: 31,
            deliveredOrders: 12,
            successfulPayments: 15,
            totalTraded: 875000
        });

        const { result } = renderHook(() => usePlatformStats());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(apiFetch).toHaveBeenCalledWith("/platform/stats");
        expect(result.current.stats).toMatchObject({ buyers: 42, verifiedSellers: 6, totalTraded: 875000 });
    });
});
