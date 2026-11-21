/**
 * lib/types.ts — re-export barrel for all shared types.
 *
 * All interfaces come from lib/data.ts so there is a single source of truth.
 * Import from here or from lib/data.ts — both work.
 */

export type {
    ProductArt,
    ProductCategory,
    Shop,
    Product,
    Category,
    TrustSignal,
    SellerNavItem,
    Metric,
    Order,
} from "./data";

import type { Product } from "./data";

/** A single line-item in the shopping cart or an order snapshot. */
export interface CartItem {
    product: Product;
    quantity: number;
    /** Snapshot values captured on order lines; absent on live cart items. */
    unitPrice?: number;
    lineTotal?: number;
}

/** A saved product in the customer's wishlist. */
export interface WishlistItem {
    product: Product;
}

/** Payment method options available at checkout. */
export type PaymentMethod = "card" | "bank-transfer" | "pay-on-delivery";

/** Delivery address and contact for an order. */
export interface DeliveryInfo {
    name: string;
    phone: string;
    address: string;
    state: string;
    notes: string;
}

/** Raw backend order lifecycle states. */
export type OrderStatusKey = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

/** Raw backend payment states. */
export type OrderPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

/** An append-only entry in an order's audit trail. */
export interface OrderEvent {
    id: string;
    fromStatus: OrderStatusKey | null;
    toStatus: OrderStatusKey;
    actorName?: string | null;
    note?: string | null;
    createdAt: string;
}

/** A placed customer order. */
export interface CustomerOrder {
    id: string;
    dbId?: string;
    customerEmail?: string;
    date: string;
    items: CartItem[];
    subtotal: number;
    total: number;
    deliveryFee: number;
    delivery: DeliveryInfo;
    payment: PaymentMethod;
    paymentStatus: OrderPaymentStatus;
    /** Display label kept for existing views. */
    status: string;
    /** Raw lifecycle state used for transitions and timeline logic. */
    statusKey: OrderStatusKey;
    events: OrderEvent[];
    shippedAt?: string | null;
    deliveredAt?: string | null;
    cancelledAt?: string | null;
    refundedAt?: string | null;
    refundAmount?: number | null;
    refundReason?: string | null;
    inventoryRestored?: boolean;
}

/** Statuses a seller/admin may move an order to from a given state. */
export const ORDER_TRANSITIONS: Record<OrderStatusKey, OrderStatusKey[]> = {
    PENDING: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["REFUNDED"],
    CANCELLED: ["REFUNDED"],
    REFUNDED: []
};

/** A product review written by a customer. */
export interface Review {
    id: string;
    targetType?: "product" | "shop";
    targetId?: string;
    productSlug: string;
    productName: string;
    rating: number;
    text: string;
    date: string;
    authorName: string;
}
