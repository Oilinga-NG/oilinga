import { apiFetch } from "@/lib/api-client";
import { mapCategory, mapOrder, mapPaymentRecord, mapProduct, mapRefundRecord, mapReview, mapShop } from "@/lib/backend-mappers";
import { defaultCategories } from "@/lib/data";

/** Compatibility adapter for the views' established data shapes; all persistence is served by oilinga_BE. */
export function slugifyShopName(value: string) {
    return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeProductStatus(value: unknown) {
    const status = String(value ?? "").toLowerCase();
    if (status === "active") return "ACTIVE";
    if (status === "out of stock" || status === "out_of_stock" || status === "outofstock") return "OUT_OF_STOCK";
    return "INACTIVE";
}

export function toBackendProductPayload(product: Record<string, any>) {
    const media = Array.isArray(product.media)
        ? product.media
            .map((item: Record<string, any>) => typeof item === "string" ? { url: item } : item)
            .filter((item: Record<string, any>) => Boolean(item?.url))
            .map((item: Record<string, any>) => ({ url: String(item.url), alt: item.alt ?? null }))
        : [];
    return {
        ...(product.shopId || product.shop ? { shopId: String(product.shopId ?? product.shop) } : {}),
        name: String(product.name ?? ""),
        ...(product.slug ? { slug: String(product.slug) } : {}),
        categoryId: product.category ?? product.categoryId ?? undefined,
        description: product.description || null,
        price: Number(product.price),
        size: product.size || null,
        stock: Number(product.stock ?? 0),
        status: normalizeProductStatus(product.status),
        imageUrl: product.imageUrl || null,
        media
    };
}

function toBackendShopPayload(shop: Record<string, any>) {
    return {
        ...(shop.slug ? { slug: String(shop.slug) } : {}),
        ...(shop.name ? { name: String(shop.name) } : {}),
        ...(shop.owner || shop.ownerName ? { owner: String(shop.owner ?? shop.ownerName) } : {}),
        ...(shop.location ? { location: String(shop.location) } : {}),
        tagline: shop.tagline ?? null,
        description: shop.description ?? null
    };
}

function queryOf(params: Record<string, string>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    const text = query.toString();
    return text ? `?${text}` : "";
}

export async function readBackendData<T>(view: string, params: Record<string, string> = {}): Promise<T> {
    let result: unknown;
    if (view === "marketplace") {
        const [products, shops, categories] = await Promise.all([
            apiFetch<{ items: Record<string, unknown>[] }>("/products?limit=100"),
            apiFetch<Record<string, unknown>[]>("/shops"),
            apiFetch<Record<string, unknown>[]>("/products/categories")
        ]);
        result = {
            products: products.items.map(mapProduct),
            shops: shops.map(row => mapShop(row)),
            categories: categories.length ? categories.map(mapCategory) : defaultCategories
        };
    } else if (view === "product") {
        try { const row = await apiFetch<Record<string, unknown>>(`/products/${encodeURIComponent(params.slug ?? "")}`); result = { product: mapProduct(row), shop: mapShop(row.shop as Record<string, unknown>) }; }
        catch (error) { if (error instanceof Error && "status" in error && error.status === 404) result = { product: null, shop: null }; else throw error; }
    } else if (view === "shop") {
        try { const row = await apiFetch<Record<string, unknown>>(`/shops/${encodeURIComponent(params.slug ?? "")}`); result = { shop: mapShop(row) }; }
        catch (error) { if (error instanceof Error && "status" in error && error.status === 404) result = { shop: null }; else throw error; }
    } else if (view === "seller") {
        const shops = await apiFetch<Record<string, unknown>[]>("/shops/mine");
        const rows = await apiFetch<Record<string, unknown>[]>("/products/mine");
        const orders = await apiFetch<Record<string, unknown>[]>("/orders/seller");
        result = { shop: shops[0] ? legacyShop(shops[0], rows) : null, orders: orders.map(row => ({ ...row, status: normalizeStatus(String(row.status)) })) };
    } else if (view === "seller-dashboard") {
        result = await apiFetch("/seller/dashboard");
    } else if (view === "seller-analytics") {
        result = await apiFetch(`/seller/analytics${queryOf(params)}`);
    } else if (view === "seller-performance") {
        result = await apiFetch("/seller/products/performance");
    } else if (view === "seller-orders") {
        result = await apiFetch(`/seller/orders${queryOf(params)}`);
    } else if (view === "seller-inventory") {
        result = await apiFetch(`/seller/inventory${queryOf(params)}`);
    } else if (view === "seller-shop") {
        result = await apiFetch("/seller/shop");
    } else if (view === "seller-earnings") {
        result = await apiFetch(`/seller/earnings${queryOf(params)}`);
    } else if (view === "seller-notifications") {
        result = await apiFetch(`/seller/notifications${queryOf(params)}`);
    } else if (view === "orders") {
        result = { orders: (await apiFetch<Record<string, unknown>[]>("/orders")).map(mapOrder) };
    } else if (view === "payments") {
        const query = params.orderId ? `?orderId=${encodeURIComponent(params.orderId)}` : "";
        result = { payments: (await apiFetch<Record<string, unknown>[]>(`/payments${query}`)).map(mapPaymentRecord) };
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
        result = {
            ...data,
            shops: data.shops.map((shop: Record<string, any>) => ({ ...legacyShop(shop), shopStatus: shop.status === "Suspended" || shop.status === "Paused" ? "Paused" : "Active" })),
            categories: (data.categories ?? []).map(mapCategory),
            orders: data.orders.map(mapOrder),
            paymentRecords: (data.paymentRecords ?? []).map(mapPaymentRecord),
            refundRecords: (data.refundRecords ?? []).map(mapRefundRecord)
        };
    } else {
        throw new Error(`Unsupported backend data view: ${view}`);
    }
    return result as T;
}

export async function mutateBackendData<T = { ok: boolean }>(action: string, payload: Record<string, unknown>): Promise<T> {
    if (action === "create-shop") {
        const shop = payload.shop as Record<string, any>;
        return await apiFetch<T>("/shops", {
            method: "POST",
            body: JSON.stringify({
                name: shop.name,
                slug: shop.slug ?? slugifyShopName(String(shop.name ?? "")),
                ownerName: shop.ownerName ?? shop.owner,
                location: shop.location,
                tagline: shop.tagline ?? null,
                description: shop.description ?? null
            })
        });
    }
    if (action === "update-shop" || action === "upsert-shop") {
        const shop = payload.shop as Record<string, any>;
        return await apiFetch<T>("/shops/mine", { method: "PATCH", body: JSON.stringify(toBackendShopPayload(shop)) });
    }
    if (action === "request-verification") return await apiFetch<T>("/shops/mine/verification-request", { method: "POST" });
    if (action === "seller-update-stock") {
        return await apiFetch<T>(`/seller/inventory/${encodeURIComponent(String(payload.productId))}/stock`, {
            method: "PATCH",
            body: JSON.stringify({ stock: Number(payload.stock) })
        });
    }
    if (action === "seller-update-shop") {
        const shop = payload.shop as Record<string, any>;
        return await apiFetch<T>("/seller/shop", {
            method: "PATCH",
            body: JSON.stringify({
                name: shop.name,
                ownerName: shop.ownerName ?? shop.owner,
                location: shop.location,
                tagline: shop.tagline || null,
                description: shop.description || null
            })
        });
    }
    if (action === "seller-request-verification") return await apiFetch<T>("/seller/shop/verification-request", { method: "POST" });
    if (action === "seller-update-order-status") {
        const { orderId, status, note } = payload as { orderId: string; status: string; note?: string };
        return await apiFetch<T>(`/seller/orders/${encodeURIComponent(orderId)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status, ...(note ? { note } : {}) })
        });
    }
    if (action === "seller-read-notification") return await apiFetch<T>(`/seller/notifications/${encodeURIComponent(String(payload.id))}/read`, { method: "PATCH" });
    if (action === "seller-read-all-notifications") return await apiFetch<T>("/seller/notifications/read-all", { method: "PATCH" });
    if (action === "set-shop-publication") {
        const publication = payload.publication as Record<string, any>;
        return await apiFetch<T>("/shops/mine/publication", {
            method: "POST",
            body: JSON.stringify({ published: Boolean(publication.published), activateProducts: Boolean(publication.activateProducts) })
        });
    }
    if (action === "create-product") {
        const product = payload.product as Record<string, any>;
        return await apiFetch<T>("/products", { method: "POST", body: JSON.stringify(toBackendProductPayload(product)) });
    }
    if (action === "update-product") {
        const product = payload.product as Record<string, any>;
        const id = String(payload.id ?? product.dbId ?? product.id ?? "");
        return await apiFetch<T>(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(toBackendProductPayload(product)) });
    }
    if (action === "delete-product") return await apiFetch<T>(`/products/${encodeURIComponent(String(payload.id))}`, { method: "DELETE" });
    if (action === "delete-shop") return await apiFetch<T>("/shops/mine", { method: "DELETE" });
    if (action === "update-order") {
        const { orderId, status, note } = payload as { orderId: string; status: string; note?: string };
        return await apiFetch<T>(`/orders/${encodeURIComponent(orderId)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status, ...(note ? { note } : {}) })
        });
    }
    if (action === "cancel-order") {
        const { orderId, reason } = payload as { orderId: string; reason?: string };
        return await apiFetch<T>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
            method: "POST",
            body: JSON.stringify(reason ? { reason } : {})
        });
    }
    if (action === "refund-order") {
        const { orderId, reason } = payload as { orderId: string; reason?: string };
        return await apiFetch<T>(`/orders/${encodeURIComponent(orderId)}/refund`, {
            method: "POST",
            body: JSON.stringify(reason ? { reason } : {})
        });
    }
    if (action === "admin-upsert-shop") {
        const shop = payload.shop as Record<string, any>;
        const shopStatus = shop.shopStatus ?? shop.status;
        return await apiFetch<T>(`/admin/shops/${encodeURIComponent(String(shop.id))}`, {
            method: "PATCH",
            body: JSON.stringify({
                verified: Boolean(shop.verified),
                published: Boolean(shop.published),
                status: String(shopStatus).toLowerCase() === "paused" ? "Paused" : "Active"
            })
        });
    }
    if (action === "admin-set-product-status") {
        const product = payload.product as Record<string, any>;
        return await apiFetch<T>(`/admin/products/${encodeURIComponent(String(payload.id ?? product.id))}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: normalizeProductStatus(product.status),
                ...(product.price !== undefined ? { price: Number(product.price) } : {}),
                ...(product.stock !== undefined ? { stock: Number(product.stock) } : {})
            })
        });
    }
    if (action === "upsert-category") {
        return await apiFetch<T>("/admin/categories", { method: "POST", body: JSON.stringify(payload.category) });
    }
    if (action === "update-category") {
        const category = payload.category as Record<string, any>;
        return await apiFetch<T>(`/admin/categories/${encodeURIComponent(String(category.id))}`, {
            method: "PATCH",
            body: JSON.stringify({ name: category.name, caption: category.caption, glyph: category.glyph })
        });
    }
    if (action === "delete-category") return await apiFetch<T>(`/admin/categories/${encodeURIComponent(String(payload.id))}`, { method: "DELETE" });
    if (action === "initialize-payment") {
        const { orderId, callbackUrl, idempotencyKey } = payload as { orderId: string; callbackUrl?: string; idempotencyKey?: string };
        return await apiFetch<T>("/payments/paystack/initialize", {
            method: "POST",
            headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : {},
            body: JSON.stringify({
                orderId,
                ...(callbackUrl ? { callbackUrl } : {}),
                ...(idempotencyKey ? { idempotencyKey } : {})
            })
        });
    }
    if (action === "verify-payment") {
        const { reference } = payload as { reference: string };
        return await apiFetch<T>("/payments/paystack/verify", {
            method: "POST",
            body: JSON.stringify({ reference })
        });
    }
    if (action === "admin-verify-payment") {
        const { reference } = payload as { reference: string };
        return await apiFetch<T>(`/admin/payments/${encodeURIComponent(reference)}/verify`, { method: "POST" });
    }
    if (action === "reconcile-payments") {
        return await apiFetch<T>("/admin/payments/reconcile");
    }
    if (action === "set-payment") {
        const { orderId, status } = payload as { orderId: string; status: string };
        // A refund changes the order lifecycle, not just the payment record.
        if (status === "Refunded") return await apiFetch<T>(`/orders/${encodeURIComponent(orderId)}/refund`, { method: "POST", body: "{}" });
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
    throw new Error(`Unsupported backend write action: ${action}`);
}

function normalizeStatus(status: string) {
    return ({ PENDING: "New", PROCESSING: "Processing", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded" } as Record<string, string>)[status] ?? status;
}

function displayProductStatus(status: unknown) {
    const value = String(status ?? "").toLowerCase();
    if (value === "active") return "Active";
    if (value === "out_of_stock" || value === "out of stock") return "Out of stock";
    return "Draft";
}

function legacyShop(row: Record<string, any>, productRows?: Record<string, any>[]) {
    const rawProducts = productRows ?? row.products ?? [];
    return {
        ...row,
        id: String(row.id ?? row.slug ?? ""),
        slug: row.slug,
        name: row.name,
        owner: row.ownerName ?? row.owner,
        location: row.location ?? "",
        tagline: row.tagline ?? "",
        description: row.description ?? "",
        verified: Boolean(row.verified),
        published: Boolean(row.published),
        verificationRequestedAt: row.verificationRequestedAt ?? null,
        status: row.status === "SUSPENDED" ? "Paused" : row.status === "DRAFT" ? "Active" : row.status ?? "Active",
        plan: row.plan ?? "Free",
        subscriptionStatus: row.subscriptionStatus ?? "Active",
        products: rawProducts.map((product: Record<string, any>) => {
            const category = product.categoryId ?? product.category ?? "crude-palm";
            return {
                ...product,
                dbId: String(product.id ?? ""),
                id: String(product.legacyId ?? product.id ?? "").split(":").at(-1),
                slug: product.slug,
                price: String(product.price),
                stock: String(product.stock),
                categoryId: category,
                category,
                status: displayProductStatus(product.status),
                imageUrl: product.imageUrl ?? null,
                media: product.media ?? [],
                description: product.description ?? "",
                size: product.size ?? ""
            };
        })
    };
}
