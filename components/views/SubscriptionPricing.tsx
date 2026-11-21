"use client";

import { useState } from "react";
import { PLANS, type BillingCycle } from "@/lib/subscription";
import { Icon } from "@/components/ui/Icon";
import { PlanCard } from "@/components/ui/PlanCard";
import { useAuth } from "@/components/auth/AuthProvider";

const faqs = [
    {
        q: "Can I change my plan at any time?",
        a: "Yes — you can upgrade, downgrade or cancel at any time from your seller dashboard. Changes take effect immediately.",
    },
    {
        q: "What happens when I cancel?",
        a: "Your shop stays active on the Starter (free) plan. You keep all your existing orders and data. Product listings above the Starter limit are automatically paused.",
    },
    {
        q: "How is commission calculated?",
        a: "Commission is deducted from each order total before the amount is settled to your account. Your plan's commission rate applies to all sales while that plan is active.",
    },
    {
        q: "Is annual billing worth it?",
        a: "Annual billing saves you the equivalent of 2 months. For Growth that is ₦19,800 saved per year, for Pro ₦49,800. Payment is taken upfront for the full year.",
    },
    {
        q: "What payment methods are accepted?",
        a: "We accept all major debit and credit cards, as well as bank transfers — all processed securely via Paystack.",
    },
];

export function SubscriptionPricing() {
    const [cycle, setCycle] = useState<BillingCycle>("monthly");
    const { user } = useAuth();

    return (
        <div className="oi-view oi-container">
            {/* Heading */}
            <div className="oi-pricing-head">
                <span className="oi-eyebrow oi-eyebrow--green">Transparent pricing</span>
                <h1 className="oi-pricing-head__title">
                    Plans that grow<br />with your business
                </h1>
                <p className="oi-pricing-head__lede">
                    Start free and upgrade when you're ready. No hidden fees.
                </p>

                {/* Billing toggle */}
                <div className="oi-pricing-toggle" role="group" aria-label="Billing cycle">
                    <button
                        type="button"
                        className={`oi-pricing-toggle__btn ${cycle === "monthly" ? "is-active" : ""}`}
                        onClick={() => setCycle("monthly")}
                    >
                        Monthly
                    </button>
                    <button
                        type="button"
                        className={`oi-pricing-toggle__btn ${cycle === "annual" ? "is-active" : ""}`}
                        onClick={() => setCycle("annual")}
                    >
                        Annual
                        <span className="oi-pricing-toggle__save">Save 2 months</span>
                    </button>
                </div>
            </div>

            {/* Plan cards */}
            <div className="oi-pricing-grid">
                {PLANS.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        cycle={cycle}
                        full
                        isCurrent={Boolean(user) && plan.id === "starter"}
                        isAuth={Boolean(user)}
                    />
                ))}
            </div>

            {/* Commission callout */}
            <div className="oi-pricing-commission">
                <Icon name="shield" size={20} />
                <p>
                    Commission rates apply to each sale.{" "}
                    <strong>Starter 4% · Growth 2.5% · Pro 1.5%</strong>.
                    Deducted before settlement — no surprises.
                </p>
            </div>

            {/* FAQ */}
            <section className="oi-section" aria-labelledby="pricing-faq-title">
                <div className="oi-section__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">Got questions?</span>
                        <h2 id="pricing-faq-title" className="oi-section__title">Pricing FAQ</h2>
                    </div>
                </div>
                <div className="oi-pricing-faq">
                    {faqs.map((faq) => (
                        <div key={faq.q} className="oi-pricing-faq__item">
                            <h3 className="oi-pricing-faq__q">{faq.q}</h3>
                            <p className="oi-pricing-faq__a">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
