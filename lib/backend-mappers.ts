import { defaultCategories, formatNaira, getCategoryArt, type Product, type Shop } from "@/lib/data";
import type { CustomerOrder } from "@/lib/types";

type Row = Record<string, any>;
export function mapProduct(row: Row): Product {
    // Backend rows expose Decimal prices as strings, admin order rows additionally
    // include a formatted label (e.g. "₦1,200"). Prefer the numeric value when present
    // and strip formatting from display strings so mapped prices never become NaN.
    const rawPrice = row.priceValue ?? row.unitPrice ?? row.price ?? 0;
    const priceValue = typeof rawPrice === "number" && Number.isFinite(rawPrice)
        ? rawPrice
        : Number(String(rawPrice).replace(/[^0-9.-]/g, "")) || 0;
    const shop = row.shop ?? {};
    const category = row.categoryId ?? row.category?.id ?? row.category ?? defaultCategories[0].id;
    const slug = row.slug ?? String(row.id ?? "");
    return { id: row.id, slug, shopSlug: shop.slug ?? row.shopSlug ?? "", seller: shop.name ?? row.seller ?? "Oilinga seller", sellerManaged: true, sellerVerified: Boolean(shop.verified ?? row.sellerVerified), name: row.name ?? "Product", detail: row.size ?? "", price: row.priceLabel ?? formatNaira(priceValue), priceValue, category, art: getCategoryArt(category), glyph: row.category?.glyph ?? "🫙", tag: row.tag ?? "Seller listed", rating: Number(row.rating ?? 0), reviews: Number(row.reviews ?? 0), stock: Number(row.stock ?? 0), size: row.size ?? "", origin: shop.location ?? row.origin ?? "Nigeria", description: row.description ?? "" };
}
export function mapShop(row: Row): Shop & { products?: Product[] } {
    const products = Array.isArray(row.products) ? row.products.map(mapProduct) : undefined;
    const categories = [...new Set((products ?? []).map(p => p.category))];
    const name = row.name ?? row.shop ?? "Oilinga shop";
    return { id: row.id, slug: row.slug, name, initials: name.trim().split(/\s+/).map((x: string) => x[0]).slice(0, 2).join("").toUpperCase(), tagline: row.tagline ?? "", description: row.description ?? "", location: row.location ?? "Nigeria", since: row.createdAt ? new Date(row.createdAt).getFullYear() : undefined, rating: Number(row.rating ?? 0), reviews: Number(row.reviews ?? 0), verified: Boolean(row.verified), categories: row.categories ?? categories, specialties: row.specialties ?? categories, accent: products?.[0]?.art ?? "palm", productsCount: row._count?.products ?? products?.length ?? 0, ...(products ? { products } : {}) };
}
export function mapOrder(row: Row): CustomerOrder {
    const status = String(row.status ?? "PENDING");
    const labels: Record<string, string> = { PENDING: "Processing", PROCESSING: "Processing", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded", New: "New" };
    const items = (row.items ?? []).map((line: Row) => {
        const snapshot = line.productSnapshot ?? {};
        const product = line.product ?? snapshot;
        return { quantity: Number(line.quantity ?? 0), product: mapProduct({ ...product, id: product.id ?? line.productId, name: product.name ?? line.productName, price: product.price ?? line.unitPrice, shop: product.shop ?? { name: line.shopName, slug: product.shopSlug }, slug: product.slug ?? String(product.id ?? line.productId ?? ""), size: product.size ?? "", stock: product.stock ?? 0 }) };
    });
    return { id: row.orderNumber ?? row.id, customerEmail: row.customerEmail, date: (row.createdAt ?? row.date ?? new Date().toISOString()), items, subtotal: Number(row.subtotal ?? row.total ?? 0), delivery: row.delivery ?? { name: row.deliveryName, phone: row.deliveryPhone, address: row.deliveryAddress, state: row.deliveryState, notes: row.deliveryNotes }, payment: row.payment ?? row.paymentMethod ?? "card", status: labels[status] ?? status };
}
export function mapReview(row: Row) {
    return { id: row.id, userId: row.userId, targetType: String(row.targetType ?? "PRODUCT").toLowerCase() as "product" | "shop", targetId: row.targetId ?? row.product?.slug ?? row.shop?.slug, productSlug: row.productSlug ?? row.product?.slug ?? row.shop?.slug ?? "", productName: row.productName ?? row.product?.name ?? row.shop?.name ?? "Shop", rating: Number(row.rating), text: row.text, date: row.date ?? row.createdAt, authorName: row.authorName ?? row.user?.name ?? "Oilinga customer" };
}
