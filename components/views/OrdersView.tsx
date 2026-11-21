"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CustomerOrder } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { readBackendData } from "@/lib/backend-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";

const statusTone: Record<string, BadgeTone> = {
    Processing: "pending",
    Shipped: "shipped",
    Delivered: "delivered",
};

function formatPrice(value: number): string {
    return "₦" + value.toLocaleString("en-NG");
}

export function OrdersView() {
    const { user, ready } = useAuth();
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (!ready) return;
        if (!user) { setHydrated(true); setOrders([]); return; }
        let cancelled = false;
        void readBackendData<{ orders: CustomerOrder[] }>("orders", user?.email ? { email: user.email } : {}).then(data => { if (!cancelled) setOrders(data.orders); }).catch(error => console.error("Orders could not be loaded", error)).finally(() => { if (!cancelled) setHydrated(true); });
        return () => { cancelled = true; };
    }, [ready, user?.email]);

    if (!hydrated) return <LoadingState label="Loading your orders" />;

    if (!user) return <main className="oi-page"><div className="oi-cart-empty"><h1 className="oi-page-title">Sign in to view your orders</h1><p className="oi-muted">Your order history is linked to your account.</p><ButtonLink href="/auth/login?next=%2Forders" variant="primary">Sign in</ButtonLink></div></main>;

    if (orders.length === 0) {
        return (
            <main className="oi-page">
                <div className="oi-cart-empty">
                    <img
                        src="/assets/illustrations/no-orders.svg"
                        alt="No orders"
                        width={180}
                        height={180}
                    />
                    <h1 className="oi-page-title">No orders yet</h1>
                    <p className="oi-muted">When you place an order it will appear here.</p>
                    <ButtonLink href="/marketplace" variant="primary">
                        Browse marketplace
                    </ButtonLink>
                </div>
            </main>
        );
    }

    return (
        <main className="oi-page">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orders" }]} />
            <h1 className="oi-page-title">Your orders</h1>
            <div className="oi-orders-list">
                {orders
                    .slice()
                    .reverse()
                    .map((order) => {
                        const firstItem = order.items[0];
                        const itemSummary = firstItem
                            ? `${firstItem.product.name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}`
                            : "—";
                        const tone: BadgeTone = statusTone[order.status] ?? "neutral";

                        return (
                            <div key={order.id} className="oi-order-row">
                                <div>
                                    <Link
                                        href={`/orders/${order.id}`}
                                        className="oi-order-row__id"
                                    >
                                        {order.id}
                                    </Link>
                                    <p className="oi-muted" style={{ fontSize: "var(--text-xs)", margin: "var(--space-1) 0" }}>
                                        {new Date(order.date).toLocaleDateString("en-NG", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </p>
                                    <p style={{ fontSize: "var(--text-sm)" }}>{itemSummary}</p>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-2)" }}>
                                    <strong style={{ fontFamily: "var(--font-display)" }}>
                                        {formatPrice(order.subtotal)}
                                    </strong>
                                    <Badge tone={tone}>{order.status}</Badge>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </main>
    );
}
