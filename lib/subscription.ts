/* ==========================================================================
   Oilinga — Subscription plan view types
   Plan records come from GET /api/v1/subscriptions/plans. Nothing here defines
   prices, commissions or features; the backend is the single source of truth.
   ========================================================================== */

export type BillingCycle = "monthly" | "annual";

export interface PlanFeature {
    text: string;
    included: boolean;
}

export interface Plan {
    id: string;
    name: string;
    tagline: string;
    monthlyPrice: number;
    annualPrice: number;
    commission: number;
    listingLimit: number;
    featured: boolean;
    features: PlanFeature[];
}

export function findPlan(plans: Plan[], id: string | undefined | null): Plan | undefined {
    return id ? plans.find(plan => plan.id === id) : undefined;
}

export function formatPrice(naira: number): string {
    if (naira === 0) return "Free";
    return `₦${naira.toLocaleString("en-NG")}`;
}

export function annualSaving(plan: Plan): number {
    if (plan.monthlyPrice === 0) return 0;
    return (plan.monthlyPrice - plan.annualPrice) * 12;
}

export function formatCommissionRates(plans: Plan[]): string {
    return plans.map(plan => `${plan.name} ${plan.commission}%`).join(" · ");
}
