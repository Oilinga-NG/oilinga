import { formatNaira, getCategoryArt, type Category, type Product, type ProductMedia, type Shop } from "@/lib/data";
import type {
    CustomerOrder,
    OrderEvent,
    OrderPaymentStatus,
    OrderStatusKey,
    PaymentMethod,
    PaymentRecord,
    PaymentRefundRecord,
    RefundRecordStatus
} from "@/lib/types";
type Row = Record<string, any>;

/** Backend shop records may use "FREE", "Starter" or a canonical plan id. */
export function normalizePlanId(value: unknown): string {
    const plan = String(value ?? "").toLowerCase().trim();
    if (plan === "growth") return "growth";
    if (plan === "pro") return "pro";
    return "starter";
}

export function normalizeSubscriptionStatus(value: unknown): "Active" | "Paused" | "Cancelled" {
    const status = String(value ?? "").toLowerCase().trim();
    if (status === "paused" || status === "suspended") return "Paused";
    if (status === "cancelled" || status === "canceled") return "Cancelled";
    return "Active";
}

/** Parse backend numeric strings (including formatted Naira labels) without producing NaN. */
function toNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (typeof value === "string") {
        const parsed = Number(value.replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

export function mapProduct(row: Row): Product {
    // Backend rows expose Decimal prices as strings, admin order rows additionally
    // include a formatted label (e.g. "₦1,200"). Prefer the numeric value when present
    // and strip formatting from display strings so mapped prices never become NaN.
    const rawPrice = row.priceValue ?? row.unitPrice ?? row.price ?? 0;
    const priceValue = toNumber(rawPrice);
    const shop = row.shop ?? {};
    const category = String(row.categoryId ?? row.category?.id ?? row.category ?? "");
    const slug = row.slug ?? String(row.id ?? "");
    const media: ProductMedia[] = Array.isArray(row.media)
        ? row.media.map((item: Row) => ({
            id: item.id ? String(item.id) : undefined,
            url: String(item.url),
            alt: item.alt ?? null,
            ...(item.isPrimary !== undefined ? { isPrimary: Boolean(item.isPrimary) } : {})
        })).filter((item: ProductMedia) => Boolean(item.url))
        : [];
    return { id: row.id, slug, shopSlug: shop.slug ?? row.shopSlug ?? "", seller: shop.name ?? row.seller ?? "Oilinga seller", sellerManaged: true, sellerVerified: Boolean(shop.verified ?? row.sellerVerified), name: row.name ?? "Product", detail: row.size ?? "", price: row.priceLabel ?? formatNaira(priceValue), priceValue, category, art: getCategoryArt(category), glyph: row.category?.glyph ?? "🫙", tag: row.tag ?? "Seller listed", rating: Number(row.rating ?? 0), reviews: Number(row.reviews ?? 0), stock: Number(row.stock ?? 0), size: row.size ?? "", origin: shop.location ?? row.origin ?? "Nigeria", description: row.description ?? "", status: row.status, imageUrl: row.imageUrl ?? null, media };
}
export function mapCategory(row: Row): Category {
    return { id: String(row.id), name: String(row.name ?? row.id), caption: String(row.caption ?? ""), glyph: String(row.glyph ?? "🫙") };
}
export function mapShop(row: Row): Shop & { products?: Product[] } {
    const products = Array.isArray(row.products) ? row.products.map(mapProduct) : undefined;
    const categories = [...new Set((products ?? []).map(p => p.category))];
    const name = row.name ?? row.shop ?? "Oilinga shop";
    return { id: row.id, slug: row.slug, name, initials: name.trim().split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase(), tagline: row.tagline ?? "", description: row.description ?? "", location: row.location ?? "Nigeria", since: row.createdAt ? new Date(row.createdAt).getFullYear() : undefined, rating: Number(row.rating ?? 0), reviews: Number(row.reviews ?? 0), verified: Boolean(row.verified), published: Boolean(row.published), status: row.status, verificationRequestedAt: row.verificationRequestedAt ?? null, categories: row.categories ?? categories, specialties: row.specialties ?? categories, accent: products?.[0]?.art ?? "palm", productsCount: row._count?.products ?? products?.length ?? 0, ...(products ? { products } : {}) };
}
const ORDER_STATUS_LABELS: Record<string, string> = {
    PENDING: "New",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
    New: "New"
};

const ORDER_STATUS_KEYS: Record<string, OrderStatusKey> = {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    SHIPPED: "SHIPPED",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
    REFUNDED: "REFUNDED",
    New: "PENDING",
    Processing: "PROCESSING",
    Shipped: "SHIPPED",
    Delivered: "DELIVERED",
    Cancelled: "CANCELLED",
    Refunded: "REFUNDED"
};

function toIso(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapPaymentMethod(value: unknown): PaymentMethod {
    const method = String(value ?? "").toLowerCase().replace(/_/g, "-");
    if (method === "paystack" || method === "card") return "card";
    if (method === "cash-on-delivery" || method === "pay-on-delivery") return "pay-on-delivery";
    return "bank-transfer";
}

function mapPaymentStatus(row: Row): OrderPaymentStatus {
    const candidates = [row.paymentStatus, row.payments?.[row.payments.length - 1]?.status].filter(Boolean);
    const status = String(candidates[0] ?? "PENDING").toUpperCase();
    return (["PENDING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status) ? status : "PENDING") as OrderPaymentStatus;
}

export function mapRefundRecord(row: Row): PaymentRefundRecord {
    const status = String(row.status ?? "PENDING").toUpperCase();
    return {
        id: String(row.id ?? ""),
        reference: String(row.reference ?? ""),
        paymentReference: row.paymentReference ? String(row.paymentReference) : undefined,
        orderNumber: row.orderNumber ? String(row.orderNumber) : undefined,
        providerReference: row.providerReference ?? null,
        amount: toNumber(row.amount),
        currency: String(row.currency ?? "NGN"),
        status: (["PENDING", "SUCCESS", "FAILED"].includes(status) ? status : "PENDING") as RefundRecordStatus,
        reason: row.reason ?? null,
        error: row.error ?? null,
        createdAt: toIso(row.createdAt) ?? new Date().toISOString()
    };
}

/** Normalize a backend payment row for customer and admin payment panels. */
export function mapPaymentRecord(row: Row): PaymentRecord {
    const status = String(row.status ?? "PENDING").toUpperCase();
    return {
        id: String(row.id ?? ""),
        orderId: String(row.orderId ?? ""),
        orderNumber: row.orderNumber ? String(row.orderNumber) : undefined,
        customer: row.customer ? String(row.customer) : undefined,
        provider: (String(row.provider ?? "OTHER").toUpperCase() as PaymentRecord["provider"]),
        status: (["PENDING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status) ? status : "PENDING") as PaymentRecord["status"],
        amount: toNumber(row.amount),
        currency: String(row.currency ?? "NGN"),
        reference: String(row.reference ?? ""),
        gatewayStatus: row.gatewayStatus ?? null,
        failureReason: row.failureReason ?? null,
        authorizationUrl: row.authorizationUrl ?? null,
        paidAt: toIso(row.paidAt),
        verifiedAt: toIso(row.verifiedAt),
        lastCheckedAt: toIso(row.lastCheckedAt),
        createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
        refunds: Array.isArray(row.refunds) ? row.refunds.map((refund: Row) => mapRefundRecord(refund)) : []
    };
}

export function mapOrder(row: Row): CustomerOrder {
    const status = String(row.status ?? "PENDING");
    const statusKey = ORDER_STATUS_KEYS[status] ?? "PENDING";
    const snapshotItems = (row.items ?? []) as Row[];
    const items = snapshotItems.map((line: Row) => {
        const snapshot = line.productSnapshot ?? {};
        const product = line.product ?? snapshot;
        return {
            quantity: toNumber(line.quantity),
            unitPrice: toNumber(line.unitPrice ?? product.priceValue ?? product.price),
            lineTotal: toNumber(line.lineTotal ?? toNumber(line.unitPrice ?? product.priceValue ?? product.price) * toNumber(line.quantity)),
            product: mapProduct({
                ...product,
                id: product.id ?? line.productId,
                name: product.name ?? line.productName,
                price: product.price ?? product.priceValue ?? line.unitPrice,
                shop: product.shop ?? { name: product.shopName ?? line.shopName, slug: product.shopSlug },
                slug: product.slug ?? String(product.id ?? line.productId ?? ""),
                size: product.size ?? "",
                stock: product.stock ?? 0
            })
        };
    });
    const events: OrderEvent[] = (row.events ?? []).map((event: Row) => ({
        id: String(event.id ?? `${event.createdAt}-${event.toStatus}`),
        fromStatus: (event.fromStatus ?? null) as OrderStatusKey | null,
        toStatus: (event.toStatus ?? statusKey) as OrderStatusKey,
        actorName: event.actorName ?? null,
        note: event.note ?? null,
        createdAt: toIso(event.createdAt) ?? toIso(row.date) ?? new Date().toISOString()
    }));
    return {
        id: row.orderNumber ?? row.id,
        dbId: row.dbId ?? row.id,
        customerEmail: row.customerEmail,
        date: toIso(row.createdAt ?? row.date) ?? new Date().toISOString(),
        items,
        subtotal: toNumber(row.subtotal ?? row.total),
        total: toNumber(row.total ?? row.subtotal),
        deliveryFee: toNumber(row.deliveryFee),
        delivery: row.delivery ?? { name: row.deliveryName, phone: row.deliveryPhone, address: row.deliveryAddress, state: row.deliveryState, notes: row.deliveryNotes },
        payment: mapPaymentMethod(row.payment ?? row.paymentMethod),
        paymentStatus: mapPaymentStatus(row),
        status: ORDER_STATUS_LABELS[status] ?? status,
        statusKey,
        events,
        shippedAt: toIso(row.shippedAt),
        deliveredAt: toIso(row.deliveredAt),
        cancelledAt: toIso(row.cancelledAt),
        refundedAt: toIso(row.refundedAt),
        refundAmount: row.refundAmount === null || row.refundAmount === undefined ? null : toNumber(row.refundAmount),
        refundReason: row.refundReason ?? null,
        inventoryRestored: Boolean(row.inventoryRestored)
    };
}
export function mapReview(row: Row) {
    return { id: row.id, userId: row.userId, targetType: String(row.targetType ?? "PRODUCT").toLowerCase() as "product" | "shop", targetId: row.targetId ?? row.product?.slug ?? row.shop?.slug, productSlug: row.productSlug ?? row.product?.slug ?? row.shop?.slug ?? "", productName: row.productName ?? row.product?.name ?? row.shop?.name ?? "Shop", rating: Number(row.rating), text: row.text, date: row.date ?? row.createdAt, authorName: row.authorName ?? row.user?.name ?? "Oilinga customer" };
}
