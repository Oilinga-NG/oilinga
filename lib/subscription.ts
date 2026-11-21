/* ==========================================================================
   Oilinga — Subscription plan definitions
   Single source of truth. Never hardcode plan details elsewhere.
   ========================================================================== */

export type PlanId = "starter" | "growth" | "pro";
export type BillingCycle = "monthly" | "annual";

export interface PlanFeature {
    text: string;
    included: boolean;
}

export interface Plan {
    id: PlanId;
    name: string;
    tagline: string;
    monthlyPrice: number;   // ₦ per month (0 = free)
    annualPrice: number;    // ₦ per month when billed annually
    commission: number;     // platform commission %
    listingLimit: number;   // max active product listings (-1 = unlimited)
    featured: boolean;      // highlighted on pricing page
    features: PlanFeature[];
}

export const PLANS: Plan[] = [
    {
        id: "starter",
        name: "Starter",
        tagline: "Everything you need to open your shop.",
        monthlyPrice: 0,
        annualPrice: 0,
        commission: 4,
        listingLimit: 5,
        featured: false,
        features: [
            { text: "Up to 5 product listings",        included: true  },
            { text: "Basic storefront page",            included: true  },
            { text: "Order management",                 included: true  },
            { text: "Standard email support",           included: true  },
            { text: "4% platform commission",           included: true  },
            { text: "Featured in marketplace",          included: false },
            { text: "Priority support",                 included: false },
            { text: "Analytics dashboard",              included: false },
            { text: "Dedicated account manager",        included: false },
        ],
    },
    {
        id: "growth",
        name: "Growth",
        tagline: "For sellers ready to scale.",
        monthlyPrice: 9900,
        annualPrice: 8250,   // ~2 months free
        commission: 2.5,
        listingLimit: 50,
        featured: true,
        features: [
            { text: "Up to 50 product listings",        included: true  },
            { text: "Full storefront customisation",    included: true  },
            { text: "Order management",                 included: true  },
            { text: "Priority support",                 included: true  },
            { text: "2.5% platform commission",         included: true  },
            { text: "Featured in marketplace",          included: true  },
            { text: "Analytics dashboard",              included: true  },
            { text: "Dedicated account manager",        included: false },
            { text: "Early access to new features",     included: false },
        ],
    },
    {
        id: "pro",
        name: "Pro",
        tagline: "Maximum visibility. Maximum growth.",
        monthlyPrice: 24900,
        annualPrice: 20750,  // ~2 months free
        commission: 1.5,
        listingLimit: -1,
        featured: false,
        features: [
            { text: "Unlimited product listings",       included: true  },
            { text: "Full storefront customisation",    included: true  },
            { text: "Order management",                 included: true  },
            { text: "Dedicated account manager",        included: true  },
            { text: "1.5% platform commission",         included: true  },
            { text: "Top placement in search",          included: true  },
            { text: "Advanced analytics",               included: true  },
            { text: "Early access to new features",     included: true  },
            { text: "Priority support",                 included: true  },
        ],
    },
];

export function getPlan(id: string): Plan | undefined {
    return PLANS.find((p) => p.id === id);
}

export function formatPrice(naira: number): string {
    if (naira === 0) return "Free";
    return `₦${naira.toLocaleString("en-NG")}`;
}

export function annualSaving(plan: Plan): number {
    if (plan.monthlyPrice === 0) return 0;
    return (plan.monthlyPrice - plan.annualPrice) * 12;
}
