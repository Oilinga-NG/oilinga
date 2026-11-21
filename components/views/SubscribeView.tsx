"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPlan, formatPrice, type BillingCycle } from "@/lib/subscription";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/api-client";

declare global {
    interface Window {
        PaystackPop?: {
            setup(opts: {
                key: string;
                email: string;
                amount: number;         // in kobo
                currency: string;
                ref: string;
                metadata?: Record<string, unknown>;
                onSuccess: (transaction: { reference: string }) => void;
                onCancel: () => void;
            }): { openIframe(): void };
        };
    }
}

type Status = "idle" | "paying" | "verifying" | "success" | "error";

interface SubscribeViewProps {
    planId: string;
    cycle?: string;
}

export function SubscribeView({ planId, cycle = "monthly" }: SubscribeViewProps) {
    const router = useRouter();
    const { user, ready } = useAuth();
    const [status, setStatus] = useState<Status>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [billingCycle, setBillingCycle] = useState<BillingCycle>(
        cycle === "annual" ? "annual" : "monthly",
    );
    const paystackLoaded = useRef(false);

    const plan = getPlan(planId);

    // Redirect if plan is invalid
    useEffect(() => {
        if (!plan) router.replace("/seller/pricing");
    }, [plan, router]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (ready && !user) {
            router.replace(`/auth/login?next=/seller/subscribe?plan=${planId}`);
        }
    }, [ready, user, router, planId]);

    // Load Paystack inline script
    useEffect(() => {
        if (paystackLoaded.current) return;
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.async = true;
        document.body.appendChild(script);
        paystackLoaded.current = true;
    }, []);

    if (!plan) return null;
    if (!ready || !user) return <div className="oi-view oi-container"><p className="oi-loading-text">Loading…</p></div>;

    const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    const totalAmount = billingCycle === "annual" ? price * 12 : price;
    const amountKobo = totalAmount * 100;

    function generateRef() {
        return `OIL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }

    async function activateSubscription(paystackRef: string | null) {
        setStatus("verifying");
        try {
            await apiFetch("/subscriptions", {
                method: "POST",
                body: JSON.stringify({
                    action: "subscribe",
                    plan: plan!.id,
                    billingCycle,
                    paystackRef,
                }),
            });
            setStatus("success");
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
            setStatus("error");
        }
    }

    function handlePay(e: FormEvent) {
        e.preventDefault();

        // Free plan — activate directly
        if (plan!.monthlyPrice === 0) {
            void activateSubscription(null);
            return;
        }

        const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
        if (!publicKey) {
            setErrorMsg("Payment gateway is not configured. Please contact support.");
            setStatus("error");
            return;
        }

        if (!window.PaystackPop) {
            setErrorMsg("Payment script is still loading. Please try again in a moment.");
            return;
        }

        setStatus("paying");
        const ref = generateRef();

        const handler = window.PaystackPop.setup({
            key: publicKey,
            email: user!.email,
            amount: amountKobo,
            currency: "NGN",
            ref,
            metadata: {
                plan: plan!.id,
                billingCycle,
                userId: user!.id,
            },
            onSuccess: (transaction) => {
                void activateSubscription(transaction.reference);
            },
            onCancel: () => {
                setStatus("idle");
            },
        });

        handler.openIframe();
    }

    if (status === "success") {
        return (
            <div className="oi-view oi-container">
                <div className="oi-subscribe-success">
                    <span className="oi-subscribe-success__icon" aria-hidden="true">
                        <Icon name="check" size={32} strokeWidth={2.5} />
                    </span>
                    <h1>You're on the {plan.name} plan!</h1>
                    <p>Your subscription is active. Start listing products and reaching buyers across Africa.</p>
                    <div className="oi-subscribe-success__actions">
                        <Link href="/seller" className="oi-btn oi-btn--primary oi-btn--lg">
                            Go to your dashboard
                            <Icon name="arrow-right" size={16} />
                        </Link>
                        <Link href="/seller/subscription" className="oi-btn oi-btn--outline oi-btn--lg">
                            View subscription
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="oi-view oi-container">
            <div className="oi-subscribe-layout">
                {/* Order summary */}
                <aside className="oi-sub-summary">
                    <span className="oi-eyebrow oi-eyebrow--green">Order summary</span>
                    <h2 className="oi-sub-summary__title">{plan.name} plan</h2>

                    {/* Billing cycle toggle */}
                    {plan.monthlyPrice > 0 && (
                        <div className="oi-sub-summary__cycle">
                            <button
                                type="button"
                                className={`oi-sub-cycle-btn ${billingCycle === "monthly" ? "is-active" : ""}`}
                                onClick={() => setBillingCycle("monthly")}
                            >
                                Monthly
                                <span>{formatPrice(plan.monthlyPrice)}/mo</span>
                            </button>
                            <button
                                type="button"
                                className={`oi-sub-cycle-btn ${billingCycle === "annual" ? "is-active" : ""}`}
                                onClick={() => setBillingCycle("annual")}
                            >
                                Annual
                                <span>{formatPrice(plan.annualPrice)}/mo · 2 months free</span>
                            </button>
                        </div>
                    )}

                    <dl className="oi-sub-summary__breakdown">
                        <div>
                            <dt>{plan.name} plan ({billingCycle})</dt>
                            <dd>{formatPrice(price)}{price > 0 ? "/mo" : ""}</dd>
                        </div>
                        {billingCycle === "annual" && price > 0 && (
                            <div>
                                <dt>Billed as</dt>
                                <dd>{formatPrice(totalAmount)}</dd>
                            </div>
                        )}
                        <div className="oi-sub-summary__total">
                            <dt>Total due today</dt>
                            <dd>{formatPrice(totalAmount)}</dd>
                        </div>
                    </dl>

                    <ul className="oi-sub-summary__features">
                        {plan.features.filter((f) => f.included).map((f) => (
                            <li key={f.text}>
                                <Icon name="check" size={13} strokeWidth={2.5} aria-hidden="true" />
                                {f.text}
                            </li>
                        ))}
                    </ul>

                    <p className="oi-sub-summary__note">
                        <Icon name="shield" size={13} aria-hidden="true" />
                        Secured by Paystack. Cancel anytime.
                    </p>
                </aside>

                {/* Payment form */}
                <div className="oi-sub-form">
                    <span className="oi-eyebrow oi-eyebrow--green">
                        {plan.monthlyPrice === 0 ? "Activate your free plan" : "Complete payment"}
                    </span>
                    <h2 className="oi-sub-form__title">
                        {plan.monthlyPrice === 0 ? "Get started for free" : "Pay with Paystack"}
                    </h2>

                    {plan.monthlyPrice > 0 && (
                        <div className="oi-sub-form__paystack-note">
                            <Icon name="lock" size={15} aria-hidden="true" />
                            <span>
                                Clicking "Pay {formatPrice(totalAmount)}" will open a secure
                                Paystack checkout. Your card details are never stored by Oilinga.
                            </span>
                        </div>
                    )}

                    <form onSubmit={handlePay} className="oi-sub-form__form">
                        <div className="oi-field">
                            <label className="oi-field__label" htmlFor="sub-email">
                                Billing email
                            </label>
                            <input
                                id="sub-email"
                                className="oi-input"
                                type="email"
                                value={user.email}
                                readOnly
                                aria-describedby="sub-email-hint"
                            />
                            <small className="oi-field__hint" id="sub-email-hint">
                                Receipt and billing notifications will be sent here.
                            </small>
                        </div>

                        {status === "error" && (
                            <p className="oi-auth__error" role="alert">{errorMsg}</p>
                        )}

                        <button
                            type="submit"
                            className="oi-btn oi-btn--primary oi-btn--lg oi-btn--block"
                            disabled={status === "paying" || status === "verifying"}
                            aria-busy={status === "paying" || status === "verifying"}
                        >
                            {status === "verifying" ? (
                                "Activating…"
                            ) : status === "paying" ? (
                                "Opening payment…"
                            ) : plan.monthlyPrice === 0 ? (
                                "Activate free plan"
                            ) : (
                                <>Pay {formatPrice(totalAmount)} <Icon name="lock" size={15} /></>
                            )}
                        </button>

                        <p className="oi-sub-form__terms">
                            By subscribing you agree to the{" "}
                            <Link href="/about">Oilinga marketplace terms</Link>.
                            {plan.monthlyPrice > 0 && " You can cancel at any time from your subscription settings."}
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
