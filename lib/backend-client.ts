import { apiFetch } from "@/lib/api-client";
import { mapOrder, mapProduct, mapReview, mapShop } from "@/lib/backend-mappers";
import { defaultCategories } from "@/lib/data";

/** Compatibility adapter for the views' established data shapes; all persistence is served by oilinga_BE. */
export function slugifyShopName(value: string) {
    return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function readBackendData<T>(view: string, params: Record<string, string> = {}): Promise<T> {
    let result: unknown;
    if (view === "marketplace") {
        const [products, shops] = await Promise.all([apiFetch<{ items: Record<string, unknown>[] }>("/products?limit=100"), apiFetch<Record<string, unknown>[]>("/shops")]);
        const mappedProducts = products.items.map(mapProduct);
        result = { products: mappedProducts, shops: shops.map(row => mapShop(row)), categories: defaultCategories };
    } else if (view === "product") {
        try { const row = await apiFetch<Record<string, unknown>>(`/products/${encodeURIComponent(params.slug ?? "")}`); result = { product: mapProduct(row), shop: mapShop(row.shop as Record<string, unknown>) }; }
        catch (error) { if (error instanceof Error && "status" in error && error.status === 404) result = { product: null, shop: null }; else throw error; }
    } else if (view === "shop") {
        try { const row = await apiFetch<Record<string, unknown>>(`/shops/${encodeURIComponent(params.slug ?? "")}`); result = { shop: mapShop(row) }; }
        catch (error) { if (error instanceof Error && "status" in error && error.status === 404) result = { shop: null }; else throw error; }
    } else if (view === "seller") {
        const rows = await apiFetch<Record<string, unknown>[]>("/shops/mine");
        const orders = await apiFetch<Record<string, unknown>[]>("/orders/seller");
        result = { shop: rows[0] ? legacyShop(rows[0]) : null, orders: orders.map(row => ({ ...row, status: normalizeStatus(String(row.status)) })) };
    } else if (view === "orders") {
        result = { orders: (await apiFetch<Record<string, unknown>[]>("/orders")).map(mapOrder) };
    } else if (view === "order") {
        try { result = { order: mapOrder(await apiFetch<Record<string, unknown>>(`/orders/${encodeURIComponent(params.id ?? "")}`)) }; }
        catch (error) { if (error instanceof Error && "status" in error && error.status === 404) result = { order: null }; else throw error; }
    } else if (view === "wishlist") {
        const rows = await apiFetch<Record<string, unknown>[]>("/wishlist");
        result = { items: rows.map(row => ({ product: mapProduct(row.product as Record<string, unknown>) })) };
    } else if (["reviews", "my-reviews", "my-shop-reviews"].includes(view)) {
        const query = new URLSearchParams();
        if (view === "my-reviews") query.set("mine", "true");
        if (view === "my-shop-reviews") query.set("myShop", "true");
        if (view === "reviews") { query.set("targetType", params.targetType === "shop" ? "SHOP" : "PRODUCT"); if (params.targetId) query.set("targetId", params.targetId); }
        result = { reviews: (await apiFetch<Record<string, unknown>[]>(`/reviews?${query}`)).map(mapReview) };
    } else if (view === "rating-stats") {
        result = await apiFetch("/reviews/stats");
    } else if (view === "admin") {
        const data = await apiFetch<Record<string, any>>("/admin/data");
        result = { ...data, shops: data.shops.map((shop: Record<string, any>) => ({ ...legacyShop(shop), shopStatus: shop.status === "SUSPENDED" ? "Paused" : "Active" })), orders: data.orders.map(mapOrder) };
    } else {
        throw new Error(`Unsupported backend data view: ${view}`);
    }
    return result as T;
}

export async function mutateBackendData<T = { ok: boolean }>(action: string, payload: Record<string, unknown>): Promise<T> {
    if (action === "upsert-shop") {
        const shop = payload.shop as Record<string, any>;
        const saved = await apiFetch("/shops/mine", { method: "PUT", body: JSON.stringify({ ...shop, owner: shop.owner, products: (shop.products ?? []).map((item: Record<string, any>) => ({ ...item, price: Number(item.price), stock: Number(item.stock) })) }) });
        return { ok: true, data: saved } as T;
    }
    if (action === "delete-shop") return await apiFetch<T>("/shops/mine", { method: "DELETE" });
    if (action === "update-order") {
        const { orderId, status } = payload as { orderId: string; status: string };
        return await apiFetch<T>(`/orders/${encodeURIComponent(orderId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    }
    if (action === "admin-upsert-shop") {
        const shop = payload.shop as Record<string, any>;
        return await apiFetch<T>(`/admin/shops/${encodeURIComponent(shop.id)}`, { method: "PATCH", body: JSON.stringify({ verified: shop.verified, published: shop.published, status: shop.status }) });
    }
    if (action === "upsert-category") {
        return await apiFetch<T>("/admin/categories", { method: "POST", body: JSON.stringify(payload.category) });
    }
    if (action === "set-payment") {
        const { orderId, status } = payload as { orderId: string; status: string };
        return await apiFetch<T>(`/admin/orders/${encodeURIComponent(orderId)}/payment`, { method: "PATCH", body: JSON.stringify({ status }) });
    }
    if (action === "set-settings") {
        const settings = payload.settings as { commissionRate: number };
        return await apiFetch<T>("/admin/settings/commission", { method: "PUT", body: JSON.stringify({ rate: settings.commissionRate }) });
    }
    if (action === "create-settlement") {
        const settlement = payload.settlement as { amount: number };
        return await apiFetch<T>("/admin/settlements", { method: "POST", body: JSON.stringify({ amount: settlement.amount }) });
    }
    if (action === "save-wishlist") {
        const items = payload.items as { product: { id?: string } }[];
        await apiFetch("/wishlist", { method: "PUT", body: JSON.stringify({ productIds: items.map(item => item.product.id).filter(Boolean) }) });
        return { ok: true } as T;
    }
    if (action === "add-review") {
        const review = payload.review as Record<string, any>;
        const saved = await apiFetch<Record<string, unknown>>("/reviews", { method: "POST", body: JSON.stringify({ targetType: review.targetType === "shop" ? "SHOP" : "PRODUCT", targetId: review.targetId ?? review.productSlug, rating: review.rating, text: review.text }) });
        return { review: mapReview(saved) } as T;
    }
    if (action === "replace-orders") {
        const orders = payload.orders as { id: string; status: string }[];
        for (const order of orders) await apiFetch(`/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: order.status }) });
        return { ok: true } as T;
    }
    throw new Error(`Unsupported backend write action: ${action}`);
}

function normalizeStatus(status: string) {
    return ({ PENDING: "New", PROCESSING: "Processing", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled" } as Record<string, string>)[status] ?? status;
}

function legacyShop(row: Record<string, any>) {
    return { ...row, owner: row.ownerName ?? row.owner, status: row.status === "SUSPENDED" ? "Paused" : row.status === "DRAFT" ? "Active" : row.status ?? "Active", plan: row.plan ?? "starter", subscriptionStatus: row.subscriptionStatus ?? "Active", products: (row.products ?? []).map((product: Record<string, any>) => ({ ...product, id: String(product.legacyId ?? product.id).split(":").at(-1), price: String(product.price), stock: String(product.stock), category: product.categoryId ?? product.category ?? "crude-palm", status: product.status === "ACTIVE" || product.status === "Active" ? "Active" : "Draft" })) };
}
