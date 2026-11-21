"use client";

import Link from "next/link";
import { formatPrice, annualSaving, type Plan, type BillingCycle } from "@/lib/subscription";
import { Icon } from "@/components/ui/Icon";

export interface PlanCardProps {
    plan: Plan;
    cycle: BillingCycle;
    /** If true show all features (included + excluded). False = show only included, max 4. */
    full?: boolean;
    /** Mark this card as the user's current plan */
    isCurrent?: boolean;
    /** Called when the free-plan CTA is clicked (used on seller landing) */
    onStartFree?: () => void;
    /** If the user is authenticated — affects CTA destinations */
    isAuth?: boolean;
}

export function PlanCard({
    plan,
    cycle,
    full = false,
    isCurrent = false,
    onStartFree,
    isAuth = false,
}: PlanCardProps) {
    const price = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    const saving = annualSaving(plan);
    const features = full
        ? plan.features
        : plan.features.filter((f) => f.included).slice(0, 4);

    const freeHref = isAuth ? "/seller" : "/auth/signup";
    const paidHref = isAuth
        ? `/seller/subscribe?plan=${plan.id}&cycle=${cycle}`
        : `/auth/signup?next=%2Fseller%2Fsubscribe%3Fplan%3D${plan.id}`;

    return (
        <article
            className={`oi-pricing-card ${plan.featured ? "oi-pricing-card--featured" : ""}`}
        >
            {plan.featured && (
                <span className="oi-pricing-card__popular">Most popular</span>
            )}

            <div className="oi-pricing-card__head">
                <h2 className="oi-pricing-card__name">{plan.name}</h2>
                <p className="oi-pricing-card__tagline">{plan.tagline}</p>
            </div>

            <div className="oi-pricing-card__price">
                <strong>{formatPrice(price)}</strong>
                {price > 0 && <span className="oi-pricing-card__period">/ month</span>}
            </div>

            {cycle === "annual" && saving > 0 && (
                <p className="oi-pricing-card__saving">Save {formatPrice(saving)} per year</p>
            )}

            {cycle === "monthly" && price > 0 && (
                <p className="oi-pricing-card__billing">Billed monthly</p>
            )}
            {cycle === "annual" && price > 0 && (
                <p className="oi-pricing-card__billing">
                    {formatPrice(price * 12)} billed annually
                </p>
            )}

            {full && (
                <p className="oi-pricing-card__commission">
                    {plan.commission}% platform commission
                </p>
            )}

            <ul className="oi-pricing-card__features">
                {features.map((f) => (
                    <li
                        key={f.text}
                        className={`oi-pricing-card__feature ${!f.included ? "oi-pricing-card__feature--off" : ""}`}
                    >
                        <Icon
                            name={f.included ? "check" : "close"}
                            size={14}
                            strokeWidth={2.5}
                            aria-hidden="true"
                        />
                        {f.text}
                    </li>
                ))}
            </ul>

            <div className="oi-pricing-card__cta">
                {isCurrent ? (
                    <span className="oi-plan-badge">Current plan</span>
                ) : plan.monthlyPrice === 0 ? (
                    onStartFree ? (
                        <button
                            type="button"
                            className={`oi-btn oi-btn--lg oi-btn--block ${plan.featured ? "oi-btn--gold" : "oi-btn--outline"}`}
                            onClick={onStartFree}
                        >
                            {isAuth ? "Create your shop" : "Get started free"}
                        </button>
                    ) : (
                        <Link
                            href={freeHref}
                            className={`oi-btn oi-btn--lg oi-btn--block ${plan.featured ? "oi-btn--gold" : "oi-btn--outline"}`}
                        >
                            {isAuth ? "Create your shop" : "Get started free"}
                        </Link>
                    )
                ) : (
                    <Link
                        href={paidHref}
                        className={`oi-btn oi-btn--lg oi-btn--block ${plan.featured ? "oi-btn--gold" : "oi-btn--primary"}`}
                    >
                        Subscribe to {plan.name}
                        <Icon name="arrow-right" size={16} />
                    </Link>
                )}
            </div>
        </article>
    );
}
