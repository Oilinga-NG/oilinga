"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CustomerOrder, OrderStatusKey, PaymentInitialization, PaymentRecord } from "@/lib/types";
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
    PARTIALLY_REFUNDED: "pending",
};

const paymentStatusLabels: Record<string, string> = {
    SUCCESS: "Payment confirmed",
    PENDING: "Awaiting payment",
    FAILED: "Payment failed",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partially refunded",
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackReference = searchParams.get("reference");
    const paymentIntent = searchParams.get("payment");
    const [order, setOrder] = useState<CustomerOrder | null | undefined>(undefined);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [busy, setBusy] = useState(false);
    const [paymentBusy, setPaymentBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const [paymentCheck, setPaymentCheck] = useState<{ state: "idle" | "verifying" | "success" | "error"; message: string }>({ state: "idle", message: "" });

    async function reloadOrderAndPayments() {
        const [orderData, paymentData] = await Promise.all([
            readBackendData<{ order: CustomerOrder | null }>("order", { id: orderId }),
            readBackendData<{ payments: PaymentRecord[] }>("payments", { orderId })
        ]);
        setOrder(orderData.order);
        setPayments(paymentData.payments);
    }

    useEffect(() => {
        if (!ready) return;
        if (!user) { setOrder(null); return; }
        let cancelled = false;
        void readBackendData<{ order: CustomerOrder | null }>("order", { id: orderId })
            .then(data => { if (!cancelled) setOrder(data.order); })
            .catch(error => { console.error("Order could not be loaded", error); if (!cancelled) setOrder(null); });
        return () => { cancelled = true; };
    }, [orderId, ready, user?.email]);

    useEffect(() => {
        if (!ready || !user || !order?.dbId) return;
        let cancelled = false;
        void readBackendData<{ payments: PaymentRecord[] }>("payments", { orderId: order.dbId })
            .then(data => { if (!cancelled) setPayments(data.payments); })
            .catch(() => { if (!cancelled) setPayments([]); });
        return () => { cancelled = true; };
    }, [order?.dbId, ready, user?.email]);

    // Paystack's callback returns the browser here. Settlement is always decided
    // by a server-side verification call, never by the query string itself.
    useEffect(() => {
        if (!ready || !user || !callbackReference) return;
        let cancelled = false;
        setPaymentCheck({ state: "verifying", message: "Confirming your payment with Paystack…" });
        void mutateBackendData<PaymentRecord>("verify-payment", { reference: callbackReference })
            .then(async () => {
                await reloadOrderAndPayments();
                if (cancelled) return;
                setPaymentCheck({ state: "success", message: "Payment confirmed. Your order is now being prepared." });
                router.replace(`/orders/${orderId}?payment=confirmed`);
            })
            .catch(error => {
                if (!cancelled) setPaymentCheck({
                    state: "error",
                    message: error instanceof Error ? error.message : "We could not confirm this payment yet."
                });
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, user?.email, callbackReference, orderId]);

    async function handleStartPayment() {
        if (paymentBusy) return;
        const pending = payments.find(payment => payment.provider === "PAYSTACK" && payment.status === "PENDING");
        if (pending?.authorizationUrl) {
            window.location.assign(pending.authorizationUrl);
            return;
        }
        setPaymentBusy(true);
        setActionError("");
        try {
            const initialized = await mutateBackendData<PaymentInitialization>("initialize-payment", {
                orderId: order?.dbId ?? orderId,
                idempotencyKey: `pay-retry-${order?.dbId ?? orderId}`,
                callbackUrl: `${window.location.origin}/orders/${orderId}?payment=verify`
            });
            if (!initialized.authorizationUrl) throw new Error("The payment provider did not return a checkout link.");
            window.location.assign(initialized.authorizationUrl);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "We could not start the payment. Please try again.");
        } finally {
            setPaymentBusy(false);
        }
    }

    async function handleCheckStatus() {
        const reference = payments.find(payment => payment.provider === "PAYSTACK")?.reference;
        if (!reference || paymentBusy) return;
        setPaymentBusy(true);
        setPaymentCheck({ state: "verifying", message: "Checking the latest payment status…" });
        try {
            await mutateBackendData<PaymentRecord>("verify-payment", { reference });
            await reloadOrderAndPayments();
            setPaymentCheck({ state: "success", message: "Payment status is up to date." });
        } catch (error) {
            setPaymentCheck({ state: "error", message: error instanceof Error ? error.message : "This payment is not confirmed yet." });
        } finally {
            setPaymentBusy(false);
        }
    }

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
    const primaryPayment = payments[0] ?? null;

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
                        {paymentStatusLabels[order.paymentStatus] ?? "Awaiting payment"}
                    </Badge>
                </div>
            </div>

            {paymentIntent === "retry" && paymentCheck.state === "idle" && (
                <div className="oi-payment-banner oi-payment-banner--pending" role="status">
                    <Icon name="shield" size={18} />
                    <div><strong>Order saved — payment pending</strong><span>Complete your payment below to start fulfilment.</span></div>
                </div>
            )}
            {paymentIntent === "confirmed" && paymentCheck.state === "idle" && (
                <div className="oi-payment-banner oi-payment-banner--success" role="status">
                    <Icon name="check" size={18} />
                    <div><strong>Payment confirmed</strong><span>We received your payment and your order is being prepared.</span></div>
                </div>
            )}
            {paymentCheck.state === "verifying" && (
                <div className="oi-payment-banner oi-payment-banner--pending" role="status">
                    <Icon name="shield" size={18} />
                    <div><strong>Secure verification in progress</strong><span>{paymentCheck.message}</span></div>
                </div>
            )}
            {paymentCheck.state === "success" && (
                <div className="oi-payment-banner oi-payment-banner--success" role="status">
                    <Icon name="check" size={18} />
                    <div><strong>Payment verified</strong><span>{paymentCheck.message}</span></div>
                </div>
            )}
            {paymentCheck.state === "error" && (
                <div className="oi-payment-banner oi-payment-banner--error" role="alert">
                    <Icon name="close" size={18} />
                    <div><strong>Payment not confirmed</strong><span>{paymentCheck.message}</span></div>
                </div>
            )}

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
                        <div className="oi-payment-panel">
                            <div className="oi-payment-panel__head">
                                <span className="oi-payment-panel__icon"><Icon name={order.payment === "card" ? "lock" : order.payment === "pay-on-delivery" ? "package" : "wallet"} size={20} /></span>
                                <div className="oi-payment-panel__identity">
                                    <strong>{paymentLabels[order.payment] ?? "Payment"}</strong>
                                    <small>{primaryPayment?.reference ? `Ref ${primaryPayment.reference}` : "No transaction yet"}</small>
                                </div>
                                <Badge tone={paymentTone[order.paymentStatus] ?? "neutral"}>
                                    {paymentStatusLabels[order.paymentStatus] ?? "Awaiting payment"}
                                </Badge>
                            </div>

                            <div className="oi-payment-panel__amount">
                                <span>Amount due</span>
                                <strong>{formatPrice(order.total)}</strong>
                            </div>

                            {primaryPayment?.failureReason && order.paymentStatus === "FAILED" && (
                                <p className="oi-payment-panel__error"><Icon name="close" size={14} /> {primaryPayment.failureReason}</p>
                            )}
                            {order.paymentStatus === "SUCCESS" && (
                                <p className="oi-payment-panel__success">
                                    <Icon name="check" size={14} />
                                    Confirmed {primaryPayment?.verifiedAt ? formatDate(primaryPayment.verifiedAt) : formatDate(order.date)}. A receipt has been recorded against this order.
                                </p>
                            )}
                            {order.paymentStatus === "PARTIALLY_REFUNDED" && (
                                <p className="oi-payment-panel__muted">A partial refund has been recorded against this transaction.</p>
                            )}
                            {order.paymentStatus === "REFUNDED" && (
                                <p className="oi-payment-panel__success"><Icon name="check" size={14} /> This payment was refunded to the original method.</p>
                            )}
                            {order.paymentStatus === "PENDING" && primaryPayment?.provider === "PAYSTACK" && (
                                <p className="oi-payment-panel__muted">Your order is reserved. Complete the secure Paystack checkout to begin fulfilment.</p>
                            )}

                            {primaryPayment && (
                                <dl className="oi-payment-panel__meta">
                                    <div><dt>Provider status</dt><dd>{primaryPayment.gatewayStatus ?? "—"}</dd></div>
                                    <div><dt>Last checked</dt><dd>{primaryPayment.lastCheckedAt ? formatDate(primaryPayment.lastCheckedAt) : "—"}</dd></div>
                                </dl>
                            )}

                            {primaryPayment?.refunds.length ? (
                                <div className="oi-payment-panel__refunds">
                                    <h3>Refund records</h3>
                                    {primaryPayment.refunds.map(refund => (
                                        <div className="oi-refund-row" key={refund.id}>
                                            <Icon name={refund.status === "SUCCESS" ? "check" : refund.status === "FAILED" ? "close" : "shield"} size={14} />
                                            <div>
                                                <strong>{formatPrice(refund.amount)} · {refund.status.toLowerCase()}</strong>
                                                <small>{refund.reference}{refund.reason ? ` · ${refund.reason}` : ""}</small>
                                                {refund.error && <small>{refund.error}</small>}
                                            </div>
                                            <time>{formatDate(refund.createdAt)}</time>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {order.paymentStatus === "PENDING" && order.payment === "card" && (
                                <div className="oi-payment-panel__actions">
                                    <button type="button" className="oi-btn oi-btn--primary oi-btn--sm" onClick={() => void handleStartPayment()} disabled={paymentBusy}>
                                        <Icon name="lock" size={14} /> {primaryPayment?.authorizationUrl ? "Continue payment" : "Pay now"}
                                    </button>
                                    {primaryPayment?.provider === "PAYSTACK" && (
                                        <button type="button" className="oi-btn oi-btn--outline oi-btn--sm" onClick={() => void handleCheckStatus()} disabled={paymentBusy}>
                                            Check status
                                        </button>
                                    )}
                                </div>
                            )}
                            {order.paymentStatus === "FAILED" && order.payment === "card" && (
                                <div className="oi-payment-panel__actions">
                                    <button type="button" className="oi-btn oi-btn--primary oi-btn--sm" onClick={() => void handleStartPayment()} disabled={paymentBusy}>
                                        <Icon name="shield" size={14} /> Retry payment
                                    </button>
                                </div>
                            )}
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
