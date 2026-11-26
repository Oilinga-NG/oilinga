"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/subscription";
import { useSubscriptionPlans } from "@/lib/subscription-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api-client";
import { Icon } from "@/components/ui/Icon";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";

interface SubData {
    plan: string;
    subscriptionStatus: "Active" | "Paused" | "Cancelled";
    billingCycle: "monthly" | "annual" | null;
    nextBillingDate: string | null;
}

interface BillingRecord {
    id: string;
    amount: number;
    date: string;
    status: string;
}

type ModalState = "none" | "cancel" | "cycle" | "delete-shop";

function isExpired(sub: SubData | null): boolean {
    if (!sub) return false;
    if (sub.subscriptionStatus === "Cancelled") return true;
    if (sub.nextBillingDate && new Date(sub.nextBillingDate) < new Date()) return true;
    return false;
}

export function SubscriptionManagement() {
    const { user, ready, refreshUser } = useAuth();
    const router = useRouter();
    const { refresh: refreshMarketplace } = useMarketplaceData();
    const { plans, loading: plansLoading } = useSubscriptionPlans();
    const [sub, setSub] = useState<SubData | null>(null);
    const [billing, setBilling] = useState<BillingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>("none");
    const [working, setWorking] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [toast, setToast] = useState("");

    function notify(msg: string) {
        setToast(msg);
        window.setTimeout(() => setToast(""), 3500);
    }

    useEffect(() => {
        if (!ready || !user) return;
        void (async () => {
            try {
                const subRes = await apiFetch<SubData & { billing?: BillingRecord[] }>("/subscriptions");
                setSub(subRes);
                setBilling(Array.isArray(subRes.billing) ? subRes.billing : []);
            } catch {
                // silently show empty state
            } finally {
                setLoading(false);
            }
        })();
    }, [ready, user]);

    async function cancelSubscription() {
        setWorking(true);
        try {
            await apiFetch("/subscriptions", {
                method: "POST",
                body: JSON.stringify({ action: "cancel" }),
            });
            setSub((prev) => prev
                ? { ...prev, plan: "starter", subscriptionStatus: "Cancelled", billingCycle: null, nextBillingDate: null }
                : prev);
            notify(`Subscription cancelled. Your shop is now on the ${fallbackPlan?.name ?? "default"} plan.`);
        } catch (err) {
            notify(err instanceof Error ? err.message : "Could not cancel subscription.");
        } finally {
            setWorking(false);
            setModal("none");
        }
    }

    async function deleteShop() {
        setWorking(true);
        try {
            await apiFetch("/shops/mine", { method: "DELETE" });
            await refreshUser();           // role reverts to customer
            await refreshMarketplace();    // flush shops + products cache immediately
            notify("Your shop has been deleted.");
            setModal("none");
            setTimeout(() => router.push("/"), 1500);
        } catch (err) {
            notify(err instanceof Error ? err.message : "Could not delete your shop.");
            setWorking(false);
            setModal("none");
        }
    }

    if (!ready || loading || plansLoading) {
        return <div className="oi-view oi-container"><p className="oi-loading-text">Loading subscription…</p></div>;
    }

    if (!user) {
        return (
            <div className="oi-view oi-container">
                <p>Please <Link href="/auth/login">sign in</Link> to manage your subscription.</p>
            </div>
        );
    }

    const fallbackPlan = plans.find(plan => plan.id === "starter") ?? plans.find(plan => plan.monthlyPrice === 0) ?? plans[0];
    const planIndex = plans.findIndex(plan => plan.id === sub?.plan);
    const plan = planIndex >= 0 ? plans[planIndex] : undefined;
    const nextPlan = planIndex >= 0 ? plans[planIndex + 1] : undefined;
    const expired = isExpired(sub);
    const isCancelled = sub?.subscriptionStatus === "Cancelled";

    return (
        <div className="oi-view oi-container">
            <div className="oi-page-heading">
                <div>
                    <span className="oi-eyebrow oi-eyebrow--green">Seller account</span>
                    <h1 className="oi-page-heading__title">Subscription</h1>
                </div>
                <Link href="/seller/pricing" className="oi-btn oi-btn--outline">
                    View all plans
                </Link>
            </div>

            {/* Expired / cancelled banner */}
            {expired && (
                <div className="oi-sub-expired-banner" role="alert">
                    <Icon name="sparkle" size={20} />
                    <div>
                        <strong>
                            {isCancelled ? "Your subscription has been cancelled." : "Your subscription has expired."}
                        </strong>
                        <span>
                            {isCancelled
                                ? `Your shop is now on the ${fallbackPlan?.name ?? "default"} plan. Some product listings may have been paused.`
                                : "Renew to restore full access to your shop features and product listings."}
                        </span>
                    </div>
                    <Link href="/seller/pricing" className="oi-btn oi-btn--primary oi-btn--sm">
                        {isCancelled ? "View plans" : "Renew now"}
                        <Icon name="arrow-right" size={14} />
                    </Link>
                </div>
            )}

            {/* Current plan card */}
            <div className="oi-sub-mgmt-card">
                <div className="oi-sub-mgmt-card__head">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">Current plan</span>
                        <h2 className="oi-sub-mgmt-card__plan">{plan?.name ?? "Plan unavailable"}</h2>
                        <p className="oi-sub-mgmt-card__tagline">{plan?.tagline}</p>
                    </div>
                    <span className={`oi-badge ${sub?.subscriptionStatus === "Active" ? "oi-badge--delivered"
                        : sub?.subscriptionStatus === "Cancelled" ? "oi-badge--red"
                            : "oi-badge--pending"
                        }`}>
                        {sub?.subscriptionStatus ?? "Unknown"}
                    </span>
                </div>

                <dl className="oi-sub-mgmt-card__meta">
                    <div>
                        <dt>Commission rate</dt>
                        <dd>{plan ? `${plan.commission}%` : "—"}</dd>
                    </div>
                    <div>
                        <dt>Product limit</dt>
                        <dd>{plan ? (plan.listingLimit === -1 ? "Unlimited" : plan.listingLimit) : "—"}</dd>
                    </div>
                    {sub?.billingCycle && (
                        <div>
                            <dt>Billing</dt>
                            <dd style={{ textTransform: "capitalize" }}>{sub.billingCycle}</dd>
                        </div>
                    )}
                    {sub?.nextBillingDate && (
                        <div>
                            <dt>{expired ? "Expired" : "Next billing"}</dt>
                            <dd style={{ color: expired ? "var(--color-danger)" : undefined }}>
                                {new Date(sub.nextBillingDate).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                            </dd>
                        </div>
                    )}
                </dl>

                <div className="oi-sub-mgmt-card__actions">
                    {/* Resubscribe if expired/cancelled */}
                    {expired ? (
                        <Link href="/seller/pricing" className="oi-btn oi-btn--primary">
                            {isCancelled ? "Choose a plan" : "Renew subscription"}
                            <Icon name="arrow-right" size={15} />
                        </Link>
                    ) : (
                        <>
                            {nextPlan && (
                                <Link href={`/seller/subscribe?plan=${nextPlan.id}`} className="oi-btn oi-btn--primary">
                                    Upgrade to {nextPlan.name}
                                    <Icon name="arrow-right" size={15} />
                                </Link>
                            )}
                            {sub?.plan !== "starter" && sub?.billingCycle && (
                                <button type="button" className="oi-btn oi-btn--outline" onClick={() => setModal("cycle")}>
                                    Change billing cycle
                                </button>
                            )}
                            {sub?.plan !== "starter" && (
                                <button
                                    type="button"
                                    className="oi-btn oi-btn--ghost"
                                    style={{ color: "var(--color-danger)" }}
                                    onClick={() => setModal("cancel")}
                                >
                                    Cancel subscription
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Billing history */}
            <section className="oi-section" aria-labelledby="billing-history-title">
                <div className="oi-section__head">
                    <div>
                        <h2 id="billing-history-title" className="oi-section__title">Billing history</h2>
                    </div>
                </div>
                {billing.length === 0 ? (
                    <div className="oi-empty oi-empty--card">
                        <span className="oi-empty__icon"><Icon name="receipt" size={26} /></span>
                        <h3>No billing records yet</h3>
                        <p>Payments will appear here after your first subscription.</p>
                    </div>
                ) : (
                    <div className="oi-table-wrap">
                        <table className="oi-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billing.map((record) => (
                                    <tr key={record.id}>
                                        <td>{new Date(record.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                                        <td>Oilinga subscription</td>
                                        <td>{formatPrice(record.amount)}</td>
                                        <td>
                                            <span className={`oi-badge ${record.status === "Confirmed" ? "oi-badge--delivered" : record.status === "Failed" ? "oi-badge--red" : "oi-badge--pending"}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Danger zone — delete shop */}
            <section className="oi-section oi-sub-danger-zone" aria-labelledby="danger-zone-title">
                <div className="oi-section__head">
                    <div>
                        <h2 id="danger-zone-title" className="oi-section__title">Danger zone</h2>
                    </div>
                </div>
                <div className="oi-sub-danger-card">
                    <div>
                        <strong>Delete your shop</strong>
                        <p>Permanently remove your shop, all product listings and shop data from Oilinga. Orders already placed are retained for buyer records. This cannot be undone.</p>
                    </div>
                    <button
                        type="button"
                        className="oi-btn oi-btn--danger"
                        onClick={() => { setDeleteConfirm(""); setModal("delete-shop"); }}
                    >
                        Delete shop
                    </button>
                </div>
            </section>

            {/* Cancel modal */}
            {modal === "cancel" && (
                <div className="oi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
                    <div className="oi-modal">
                        <h2 id="cancel-modal-title">Cancel subscription?</h2>
                        <p>
                            Your shop will move to the <strong>{fallbackPlan?.name ?? "default"}</strong> plan immediately.
                            {fallbackPlan && fallbackPlan.listingLimit >= 0 && <> Product listings above the {fallbackPlan.listingLimit}-listing limit will be paused.</>}
                        </p>
                        <div className="oi-modal__actions">
                            <button type="button" className="oi-btn oi-btn--danger" onClick={cancelSubscription} disabled={working}>
                                {working ? "Cancelling…" : "Yes, cancel subscription"}
                            </button>
                            <button type="button" className="oi-btn oi-btn--outline" onClick={() => setModal("none")} disabled={working}>
                                Keep my plan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change billing cycle modal */}
            {modal === "cycle" && (
                <div className="oi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cycle-modal-title">
                    <div className="oi-modal">
                        <h2 id="cycle-modal-title">Change billing cycle</h2>
                        <p>
                            To switch between monthly and annual billing, start a new subscription with your preferred cycle.
                            You'll be charged the new amount from today.
                        </p>
                        <div className="oi-modal__actions">
                            <Link
                                href={`/seller/subscribe?plan=${sub?.plan}&cycle=${sub?.billingCycle === "monthly" ? "annual" : "monthly"}`}
                                className="oi-btn oi-btn--primary"
                                onClick={() => setModal("none")}
                            >
                                Switch to {sub?.billingCycle === "monthly" ? "annual" : "monthly"} billing
                            </Link>
                            <button type="button" className="oi-btn oi-btn--outline" onClick={() => setModal("none")}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete shop modal */}
            {modal === "delete-shop" && (
                <div className="oi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-shop-modal-title">
                    <div className="oi-modal">
                        <h2 id="delete-shop-modal-title" style={{ color: "var(--color-danger)" }}>Delete your shop?</h2>
                        <p>
                            This will permanently delete your shop, all product listings and shop data.
                            <strong> This action cannot be undone.</strong>
                        </p>
                        <div className="oi-field" style={{ marginBottom: "var(--space-5)" }}>
                            <label className="oi-field__label" htmlFor="delete-confirm">
                                Type <strong>DELETE</strong> to confirm
                            </label>
                            <input
                                id="delete-confirm"
                                className="oi-input"
                                type="text"
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                placeholder="DELETE"
                                autoComplete="off"
                            />
                        </div>
                        <div className="oi-modal__actions">
                            <button
                                type="button"
                                className="oi-btn oi-btn--danger"
                                onClick={deleteShop}
                                disabled={working || deleteConfirm !== "DELETE"}
                            >
                                {working ? "Deleting…" : "Yes, permanently delete my shop"}
                            </button>
                            <button type="button" className="oi-btn oi-btn--outline" onClick={() => setModal("none")} disabled={working}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="oi-toast is-visible" role="status" aria-live="polite">{toast}</div>
            )}
        </div>
    );
}
