"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CustomerOrder } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { readBackendData } from "@/lib/backend-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";

function formatPrice(value: number): string {
    return "₦" + value.toLocaleString("en-NG");
}

const statusTone: Record<string, BadgeTone> = {
    Processing: "pending",
    Shipped: "shipped",
    Delivered: "delivered",
};

type TimelineStep = {
    label: string;
    done: boolean;
    active: boolean;
};

function buildTimeline(status: string): TimelineStep[] {
    const labels = ["Order placed", "Processing", "Shipped", "Delivered"];
    const doneCount =
        status === "Processing"
            ? 2
            : status === "Shipped"
            ? 3
            : status === "Delivered"
            ? 4
            : 1;

    return labels.map((label, i) => ({
        label,
        done: i < doneCount - 1,
        active: i === doneCount - 1,
    }));
}

interface Props {
    orderId: string;
}

export function OrderDetailView({ orderId }: Props) {
    const { user, ready } = useAuth();
    const [order, setOrder] = useState<CustomerOrder | null | undefined>(undefined);

    useEffect(() => {
        if (!ready) return;
        if (!user) { setOrder(null); return; }
        let cancelled = false;
        void readBackendData<{ order: CustomerOrder | null }>("order", { id: orderId }).then(data => { if (!cancelled) setOrder(data.order); }).catch(error => { console.error("Order could not be loaded", error); if (!cancelled) setOrder(null); });
        return () => { cancelled = true; };
    }, [orderId, ready, user?.email]);

    if (!ready || order === undefined) return <LoadingState label="Loading order details" />;

    if (!user) return <main className="oi-page"><div className="oi-cart-empty"><h1 className="oi-page-title">Sign in to view this order</h1><p className="oi-muted">Order details are only available to the account that placed the order.</p><ButtonLink href={`/auth/login?next=${encodeURIComponent(`/orders/${orderId}`)}`} variant="primary">Sign in</ButtonLink></div></main>;

    if (order === null) {
        return (
            <main className="oi-page">
                <div className="oi-cart-empty">
                    <h1 className="oi-page-title">Order not found</h1>
                    <p className="oi-muted">We couldn't find an order with ID "{orderId}".</p>
                    <ButtonLink href="/orders" variant="outline">
                        View all orders
                    </ButtonLink>
                </div>
            </main>
        );
    }

    const timeline = buildTimeline(order.status);
    const tone: BadgeTone = statusTone[order.status] ?? "neutral";
    const firstItemSlug = order.items[0]?.product.slug ?? "";

    return (
        <main className="oi-page">
            <Breadcrumbs
                items={[
                    { label: "Home", href: "/" },
                    { label: "Orders", href: "/orders" },
                    { label: order.id },
                ]}
            />

            {/* Order header */}
            <div className="oi-dashboard__top" style={{ marginBottom: "var(--space-6)" }}>
                <div>
                    <h1 className="oi-page-title">{order.id}</h1>
                    <p className="oi-muted" style={{ fontSize: "var(--text-xs)" }}>
                        Placed on{" "}
                        {new Date(order.date).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
                <Badge tone={tone}>{order.status}</Badge>
            </div>

            {/* Timeline */}
            <div className="oi-order-timeline" role="list" aria-label="Order progress">
                {timeline.map((step, i) => (
                    <div
                        key={step.label}
                        className={cn(
                            "oi-timeline-step",
                            step.done && "is-done",
                            step.active && "is-active",
                        )}
                        role="listitem"
                    >
                        {i > 0 && <div className="oi-timeline-connector" aria-hidden="true" />}
                        <div className="oi-timeline-step__circle" aria-hidden="true">
                            {step.done ? (
                                <Icon name="check" size={14} />
                            ) : (
                                <span style={{ fontSize: "var(--text-xs)" }}>{i + 1}</span>
                            )}
                        </div>
                        <span className="oi-timeline-step__label">{step.label}</span>
                    </div>
                ))}
            </div>

            {/* Detail grid */}
            <div className="oi-order-detail-grid">
                {/* Items table */}
                <div>
                    <h2 className="oi-card-head">Items ordered</h2>
                    <div className="oi-table-wrap">
                        <table className="oi-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th style={{ textAlign: "center" }}>Qty</th>
                                    <th style={{ textAlign: "right" }}>Unit price</th>
                                    <th style={{ textAlign: "right" }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map(({ product, quantity }) => (
                                    <tr key={product.slug}>
                                        <td>{product.name}</td>
                                        <td style={{ textAlign: "center" }}>{quantity}</td>
                                        <td style={{ textAlign: "right" }}>{product.price}</td>
                                        <td style={{ textAlign: "right" }}>
                                            {formatPrice(product.priceValue * quantity)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>
                                        Total
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                                        {formatPrice(order.subtotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Delivery card */}
                <div>
                    <h2 className="oi-card-head">Delivery details</h2>
                    <div className="oi-dash-card">
                        <p style={{ fontWeight: "bold" }}>{order.delivery.name}</p>
                        <p className="oi-muted" style={{ fontSize: "var(--text-sm)" }}>
                            {order.delivery.phone}
                        </p>
                        <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                            {order.delivery.address}
                        </p>
                        <p style={{ fontSize: "var(--text-sm)" }}>{order.delivery.state}</p>
                        {order.delivery.notes && (
                            <p className="oi-muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-2)" }}>
                                {order.delivery.notes}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Help */}
            <p style={{ marginTop: "var(--space-8)", fontSize: "var(--text-sm)" }}>
                Need help?{" "}
                <a href="mailto:support@oilinga.com" className="oi-link">
                    Contact support
                </a>
            </p>

            {/* Review CTA */}
            {order.status === "Delivered" && firstItemSlug && (
                <div style={{ marginTop: "var(--space-4)" }}>
                    <ButtonLink
                        href={`/account/reviews?product=${firstItemSlug}`}
                        variant="outline"
                    >
                        Write a review
                    </ButtonLink>
                </div>
            )}
        </main>
    );
}
