"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerOrder } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { readBackendData } from "@/lib/backend-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/lib/cn";

const statusTone: Record<string, BadgeTone> = {
    New: "blue",
    Processing: "pending",
    Shipped: "shipped",
    Delivered: "delivered",
    Cancelled: "red",
    Refunded: "neutral",
};

const paymentTone: Record<string, BadgeTone> = {
    SUCCESS: "green",
    PENDING: "gold",
    FAILED: "red",
    REFUNDED: "neutral",
};

type Filter = "all" | "active" | "delivered" | "closed";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All orders" },
    { id: "active", label: "In progress" },
    { id: "delivered", label: "Delivered" },
    { id: "closed", label: "Cancelled & refunded" },
];

function formatPrice(value: number): string {
    return "₦" + value.toLocaleString("en-NG");
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function matchesFilter(order: CustomerOrder, filter: Filter): boolean {
    if (filter === "all") return true;
    if (filter === "active") return ["PENDING", "PROCESSING", "SHIPPED"].includes(order.statusKey);
    if (filter === "delivered") return order.statusKey === "DELIVERED";
    return ["CANCELLED", "REFUNDED"].includes(order.statusKey);
}

export function OrdersView() {
    const { user, ready } = useAuth();
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [filter, setFilter] = useState<Filter>("all");

    useEffect(() => {
        if (!ready) return;
        if (!user) { setHydrated(true); setOrders([]); return; }
        let cancelled = false;
        void readBackendData<{ orders: CustomerOrder[] }>("orders", user?.email ? { email: user.email } : {})
            .then(data => { if (!cancelled) setOrders(data.orders); })
            .catch(error => console.error("Orders could not be loaded", error))
            .finally(() => { if (!cancelled) setHydrated(true); });
        return () => { cancelled = true; };
    }, [ready, user?.email]);

    const counts = useMemo(() => ({
        all: orders.length,
        active: orders.filter(order => matchesFilter(order, "active")).length,
        delivered: orders.filter(order => matchesFilter(order, "delivered")).length,
        closed: orders.filter(order => matchesFilter(order, "closed")).length,
    }), [orders]);

    const visible = useMemo(() => orders.filter(order => matchesFilter(order, filter)), [orders, filter]);

    if (!hydrated) return <LoadingState label="Loading your orders" />;

    if (!user) return <main className="oi-page"><div className="oi-cart-empty"><h1 className="oi-page-title">Sign in to view your orders</h1><p className="oi-muted">Your order history is linked to your account.</p><ButtonLink href="/auth/login?next=%2Forders" variant="primary">Sign in</ButtonLink></div></main>;

    if (orders.length === 0) {
        return (
            <main className="oi-page">
                <div className="oi-cart-empty">
                    <img src="/assets/illustrations/no-orders.svg" alt="No orders" width={180} height={180} />
                    <h1 className="oi-page-title">No orders yet</h1>
                    <p className="oi-muted">When you place an order it will appear here.</p>
                    <ButtonLink href="/marketplace" variant="primary">Browse marketplace</ButtonLink>
                </div>
            </main>
        );
    }

    return (
        <main className="oi-page">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orders" }]} />
            <div className="oi-orders-header">
                <div>
                    <h1 className="oi-page-title">Your orders</h1>
                    <p className="oi-muted">Track purchases, review delivery details and revisit past orders.</p>
                </div>
                <Badge tone="neutral">{counts.active} in progress</Badge>
            </div>

            <div className="oi-orders-toolbar" role="tablist" aria-label="Filter orders">
                {FILTERS.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === item.id}
                        className={cn("oi-orders-filter", filter === item.id && "is-active")}
                        onClick={() => setFilter(item.id)}
                    >
                        {item.label} <span>{counts[item.id]}</span>
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <div className="oi-orders-empty">
                    <Icon name="receipt" size={26} />
                    <p>No orders match this filter.</p>
                </div>
            ) : (
                <div className="oi-orders-list">
                    {visible.map(order => (
                        <article key={order.id} className="oi-order-card">
                            <div className="oi-order-card__top">
                                <div>
                                    <Link href={`/orders/${order.id}`} className="oi-order-row__id">{order.id}</Link>
                                    <p className="oi-order-card__meta">
                                        <Icon name="calendar" size={13} /> {formatDate(order.date)}
                                        <span aria-hidden="true">·</span>
                                        {order.items.length} {order.items.length === 1 ? "item" : "items"}
                                    </p>
                                </div>
                                <Badge tone={statusTone[order.status] ?? "neutral"}>{order.status}</Badge>
                            </div>

                            <div className="oi-order-card__items">
                                {order.items.slice(0, 4).map(({ product, quantity }, index) => (
                                    <div className="oi-order-thumb" key={`${product.slug}-${index}`} title={`${product.name} × ${quantity}`}>
                                        {product.imageUrl
                                            ? <img src={product.imageUrl} alt="" />
                                            : <Icon name="package" size={18} />}
                                        <span>{quantity}</span>
                                    </div>
                                ))}
                                <div className="oi-order-card__names">
                                    <strong>{order.items[0]?.product.name ?? "Order items"}</strong>
                                    <span className="oi-muted">
                                        {order.items.length > 1 ? `+ ${order.items.length - 1} more item${order.items.length > 2 ? "s" : ""}` : "Ready to review"}
                                    </span>
                                </div>
                            </div>

                            <div className="oi-order-card__foot">
                                <div className="oi-order-card__payment">
                                    <Badge tone={paymentTone[order.paymentStatus] ?? "neutral"}>
                                        {order.paymentStatus === "SUCCESS" ? "Paid" : order.paymentStatus === "REFUNDED" ? "Refunded" : order.paymentStatus === "FAILED" ? "Payment failed" : "Awaiting payment"}
                                    </Badge>
                                    <strong>{formatPrice(order.total)}</strong>
                                </div>
                                <Link href={`/orders/${order.id}`} className="oi-order-card__link">
                                    View details <Icon name="arrow-right" size={15} />
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
}
