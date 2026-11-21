"use client";

import { useEffect, useState } from "react";
import type { CustomerOrder, OrderStatusKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { mapOrder } from "@/lib/backend-mappers";
import { mutateBackendData, readBackendData } from "@/lib/backend-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";

function formatPrice(value: number): string {
    return "₦" + value.toLocaleString("en-NG");
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-NG", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

const statusLabels: Record<OrderStatusKey, string> = {
    PENDING: "New",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
};

const statusTone: Record<string, BadgeTone> = {
    New: "blue",
    Processing: "pending",
    Shipped: "shipped",
    Delivered: "delivered",
    Cancelled: "red",
    Refunded: "neutral",
};

const paymentLabels: Record<string, string> = {
    card: "Card payment",
    "bank-transfer": "Bank transfer",
    "pay-on-delivery": "Pay on delivery",
};

const paymentTone: Record<string, BadgeTone> = {
    SUCCESS: "green",
    PENDING: "gold",
    FAILED: "red",
    REFUNDED: "neutral",
};

type TimelineStep = { label: string; done: boolean; active: boolean; date?: string | null };

function buildTimeline(order: CustomerOrder): TimelineStep[] {
    if (order.statusKey === "CANCELLED" || order.statusKey === "REFUNDED") {
        return [
            { label: "Order placed", done: true, active: false, date: order.date },
            { label: statusLabels[order.statusKey], done: false, active: true, date: order.refundedAt ?? order.cancelledAt },
        ];
    }
    const doneCount = ({ PENDING: 1, PROCESSING: 2, SHIPPED: 3, DELIVERED: 4 } as Record<string, number>)[order.statusKey] ?? 1;
    const dates = [order.date, null, order.shippedAt, order.deliveredAt];
    return ["Order placed", "Processing", "Shipped", "Delivered"].map((label, index) => ({
        label,
        done: index < doneCount - 1,
        active: index === doneCount - 1,
        date: dates[index],
    }));
}

interface Props {
    orderId: string;
}

export function OrderDetailView({ orderId }: Props) {
    const { user, ready } = useAuth();
    const [order, setOrder] = useState<CustomerOrder | null | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");

    useEffect(() => {
        if (!ready) return;
        if (!user) { setOrder(null); return; }
        let cancelled = false;
        void readBackendData<{ order: CustomerOrder | null }>("order", { id: orderId })
            .then(data => { if (!cancelled) setOrder(data.order); })
            .catch(error => { console.error("Order could not be loaded", error); if (!cancelled) setOrder(null); });
        return () => { cancelled = true; };
    }, [orderId, ready, user?.email]);

    async function handleCancel() {
        if (!order || busy) return;
        setBusy(true);
        setActionError("");
        try {
            const updated = await mutateBackendData<Record<string, unknown>>("cancel-order", {
                orderId: order.dbId ?? order.id,
                reason: "Cancelled by customer",
            });
            setOrder(mapOrder(updated));
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "We could not cancel this order.");
        } finally {
            setBusy(false);
        }
    }

    if (!ready || order === undefined) return <LoadingState label="Loading order details" />;

    if (!user) return <main className="oi-page"><div className="oi-cart-empty"><h1 className="oi-page-title">Sign in to view this order</h1><p className="oi-muted">Order details are only available to the account that placed the order.</p><ButtonLink href={`/auth/login?next=${encodeURIComponent(`/orders/${orderId}`)}`} variant="primary">Sign in</ButtonLink></div></main>;

    if (order === null) {
        return (
            <main className="oi-page">
                <div className="oi-cart-empty">
                    <h1 className="oi-page-title">Order not found</h1>
                    <p className="oi-muted">We couldn't find an order with ID "{orderId}".</p>
                    <ButtonLink href="/orders" variant="outline">View all orders</ButtonLink>
                </div>
            </main>
        );
    }

    const timeline = buildTimeline(order);
    const tone: BadgeTone = statusTone[order.status] ?? "neutral";
    const firstItemSlug = order.items[0]?.product.slug ?? "";
    const canCancel = ["PENDING", "PROCESSING"].includes(order.statusKey);

    return (
        <main className="oi-page oi-order-detail">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orders", href: "/orders" }, { label: order.id }]} />

            <div className="oi-order-detail__header">
                <div>
                    <span className="oi-eyebrow">ORDER DETAILS</span>
                    <h1 className="oi-page-title">{order.id}</h1>
                    <p className="oi-muted">Placed on {formatDate(order.date)}</p>
                </div>
                <div className="oi-order-detail__header-actions">
                    <Badge tone={tone}>{order.status}</Badge>
                    <Badge tone={paymentTone[order.paymentStatus] ?? "neutral"}>
                        {order.paymentStatus === "SUCCESS" ? "Payment confirmed" : order.paymentStatus === "REFUNDED" ? "Refunded" : order.paymentStatus === "FAILED" ? "Payment failed" : "Awaiting payment"}
                    </Badge>
                </div>
            </div>

            {order.statusKey === "REFUNDED" && (
                <div className="oi-order-detail__notice">
                    <Icon name="shield" size={18} />
                    <div>
                        <strong>Refund recorded</strong>
                        <span>{order.refundAmount ? `${formatPrice(order.refundAmount)} refunded. ` : ""}{order.refundReason ?? "Your refund has been processed."} It may take a few days to reflect in your account.</span>
                    </div>
                </div>
            )}
            {order.statusKey === "CANCELLED" && (
                <div className="oi-order-detail__notice oi-order-detail__notice--muted">
                    <Icon name="receipt" size={18} />
                    <div>
                        <strong>Order cancelled</strong>
                        <span>{order.inventoryRestored ? "Reserved stock has been returned to the marketplace." : "This order is no longer being fulfilled."}</span>
                    </div>
                </div>
            )}

            <div className="oi-order-timeline" role="list" aria-label="Order progress">
                {timeline.map((step, index) => (
                    <div
                        key={step.label}
                        className={cn("oi-timeline-step", step.done && "is-done", step.active && "is-active")}
                        role="listitem"
                    >
                        {index > 0 && <div className="oi-timeline-connector" aria-hidden="true" />}
                        <div className="oi-timeline-step__circle" aria-hidden="true">
                            {step.done ? <Icon name="check" size={14} /> : <span style={{ fontSize: "var(--text-xs)" }}>{index + 1}</span>}
                        </div>
                        <span className="oi-timeline-step__label">{step.label}</span>
                        {step.date && <small className="oi-timeline-step__date">{formatDate(step.date)}</small>}
                    </div>
                ))}
            </div>

            <div className="oi-order-detail-grid">
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
                                {order.items.map(({ product, quantity, unitPrice, lineTotal }, index) => (
                                    <tr key={`${product.slug}-${index}`}>
                                        <td>
                                            <div className="oi-order-line-product">
                                                {product.imageUrl && <img src={product.imageUrl} alt="" />}
                                                <span>{product.name}<small>{product.seller}</small></span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: "center" }}>{quantity}</td>
                                        <td style={{ textAlign: "right" }}>{formatPrice(unitPrice ?? product.priceValue)}</td>
                                        <td style={{ textAlign: "right" }}>{formatPrice(lineTotal ?? product.priceValue * quantity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr><td colSpan={3} style={{ textAlign: "right" }}>Subtotal</td><td style={{ textAlign: "right" }}>{formatPrice(order.subtotal)}</td></tr>
                                <tr><td colSpan={3} style={{ textAlign: "right" }}>Delivery</td><td style={{ textAlign: "right" }}>{order.deliveryFee ? formatPrice(order.deliveryFee) : "Included"}</td></tr>
                                <tr><td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>Total</td><td style={{ textAlign: "right", fontWeight: "bold" }}>{formatPrice(order.total)}</td></tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="oi-order-detail__side">
                    <div>
                        <h2 className="oi-card-head">Delivery details</h2>
                        <div className="oi-dash-card">
                            <p style={{ fontWeight: "bold" }}>{order.delivery.name}</p>
                            <p className="oi-muted" style={{ fontSize: "var(--text-sm)" }}>{order.delivery.phone}</p>
                            <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>{order.delivery.address}</p>
                            <p style={{ fontSize: "var(--text-sm)" }}>{order.delivery.state}</p>
                            {order.delivery.notes && <p className="oi-muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-2)" }}>{order.delivery.notes}</p>}
                        </div>
                    </div>
                    <div>
                        <h2 className="oi-card-head">Payment</h2>
                        <div className="oi-dash-card">
                            <p style={{ fontWeight: "bold" }}>{paymentLabels[order.payment] ?? "Payment"}</p>
                            <p className="oi-muted" style={{ fontSize: "var(--text-sm)" }}>Status: {order.paymentStatus.toLowerCase()}</p>
                            <p className="oi-muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-2)" }}>
                                Snapshots of product names and prices are stored with this order, so its value never changes when a listing changes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="oi-order-detail__history">
                <h2 className="oi-card-head">Order history</h2>
                <ol className="oi-event-list">
                    {order.events.length === 0 && <li className="oi-muted">No status changes recorded yet.</li>}
                    {order.events.map(event => (
                        <li key={event.id}>
                            <span className="oi-event-list__dot" aria-hidden="true" />
                            <div>
                                <strong>{event.note ?? `${event.fromStatus ? `${statusLabels[event.fromStatus]} → ` : ""}${statusLabels[event.toStatus]}`}</strong>
                                <span className="oi-muted">
                                    {event.actorName ? `${event.actorName} · ` : ""}{formatDate(event.createdAt)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            {actionError && <p className="oi-form-error" role="alert" style={{ marginTop: "var(--space-4)" }}>{actionError}</p>}

            <div className="oi-order-detail__actions">
                <ButtonLink href="/orders" variant="outline"><Icon name="arrow-left" size={15} /> All orders</ButtonLink>
                {canCancel && (
                    <button type="button" className="oi-btn oi-btn--danger" onClick={() => void handleCancel()} disabled={busy}>
                        {busy ? "Cancelling…" : "Cancel order"}
                    </button>
                )}
                {order.statusKey === "DELIVERED" && firstItemSlug && (
                    <ButtonLink href={`/account/reviews?product=${firstItemSlug}`} variant="primary">Write a review <Icon name="arrow-right" size={15} /></ButtonLink>
                )}
            </div>

            <p style={{ marginTop: "var(--space-8)", fontSize: "var(--text-sm)" }}>
                Need help? <a href="mailto:support@oilinga.com" className="oi-link">Contact support</a>
            </p>
        </main>
    );
}
