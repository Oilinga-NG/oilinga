"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { Product } from "./data";
import { mapProduct } from "@/lib/backend-mappers";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";

/** A single line-item in the shopping cart. */
export interface CartItem {
    product: Product;
    quantity: number;
    /** Trusted value supplied by the backend when the cart came from the database. */
    lineTotal?: number;
}

interface CartContextValue {
    items: CartItem[];
    totalCount: number;
    subtotal: number;
    addItem: (product: Product) => Promise<boolean>;
    removeItem: (slug: string) => Promise<boolean>;
    clearCart: () => Promise<boolean>;
    updateQty: (slug: string, qty: number) => Promise<boolean>;
}

type Row = Record<string, any>;

interface CartRow {
    id?: string;
    productId?: string;
    quantity: number;
    priceValue?: string | number;
    lineTotal?: string | number;
    product: Row;
}

const CART_KEY = "oilinga.cart";

export const CartContext = createContext<CartContextValue | null>(null);

function snapshotKey(identity: string) {
    return `${CART_KEY}:${identity}`;
}

function sameProduct(left: Product, right: Product): boolean {
    if (left.id && right.id) return left.id === right.id;
    return left.slug === right.slug;
}

function lineTotalFor(item: CartItem, quantity = item.quantity): number {
    const stored = item.lineTotal;
    const expected = item.product.priceValue * quantity;
    if (quantity === item.quantity && typeof stored === "number" && Number.isFinite(stored)) return stored;
    return expected;
}

function withQuantity(item: CartItem, quantity: number): CartItem {
    return { ...item, quantity, lineTotal: item.product.priceValue * quantity };
}

function sumLines(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + lineTotalFor(item), 0);
}

function normalizeCartItem(row: CartRow): CartItem {
    const product = mapProduct(row.product);
    const quantity = Math.max(1, Math.floor(Number(row.quantity) || 1));
    const reported = row.lineTotal !== undefined ? Number(row.lineTotal) : NaN;
    const lineTotal = Number.isFinite(reported) ? reported : product.priceValue * quantity;
    return { product, quantity, lineTotal };
}

function normalizeSummary(data: unknown): { items: CartItem[]; subtotal: number | null } {
    if (Array.isArray(data)) {
        const items = (data as CartRow[]).map(normalizeCartItem);
        return { items, subtotal: sumLines(items) };
    }
    if (data && typeof data === "object" && Array.isArray((data as Row).items)) {
        const summary = data as Row;
        const items = (summary.items as CartRow[]).map(normalizeCartItem);
        const reported = Number(summary.subtotal);
        return { items, subtotal: Number.isFinite(reported) ? reported : sumLines(items) };
    }
    return { items: [], subtotal: 0 };
}

interface CartSnapshotItem {
    productId?: string;
    quantity: number;
}

/** Local storage keeps only product ids and quantities; product details always come from the API. */
function readCartSnapshot(identity: string): CartSnapshotItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(snapshotKey(identity))
            ?? (identity === "guest" ? window.localStorage.getItem(CART_KEY) : null);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return (parsed as Row[]).flatMap((row): CartSnapshotItem[] => {
            if (!row || typeof row !== "object") return [];
            const productId = typeof row.productId === "string" ? row.productId
                : typeof row.product?.id === "string" ? row.product.id : undefined;
            const quantity = Math.floor(Number(row.quantity));
            return productId && quantity > 0 ? [{ productId, quantity }] : [];
        });
    } catch {
        return [];
    }
}

async function rehydrateCartSnapshot(identity: string): Promise<CartItem[]> {
    const snapshot = readCartSnapshot(identity);
    const ids = [...new Set(snapshot.map(item => item.productId).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return [];
    try {
        const data = await apiFetch<{ items?: Row[] }>(`/products/by-ids?ids=${encodeURIComponent(ids.join(","))}`);
        const rows = Array.isArray(data) ? data : data.items ?? [];
        const products = new Map(rows.map(row => [String(row.id), mapProduct(row)]));
        return snapshot.flatMap(item => {
            const product = products.get(item.productId!);
            return product ? [withQuantity({ product, quantity: item.quantity }, item.quantity)] : [];
        });
    } catch {
        return [];
    }
}

function writeCart(identity: string, items: CartItem[]) {
    try {
        const snapshot = items
            .filter(item => item.product.id)
            .map(item => ({ productId: item.product.id, quantity: item.quantity }));
        window.localStorage.setItem(snapshotKey(identity), JSON.stringify(snapshot));
    } catch {
        // Storage may be unavailable in private browsing; in-memory state still works.
    }
}

function removeSnapshot(identity: string) {
    try {
        window.localStorage.removeItem(snapshotKey(identity));
        if (identity === "guest") window.localStorage.removeItem(CART_KEY);
    } catch {
        // Ignore storage failures.
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const { user, ready: authReady } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [trustedSubtotal, setTrustedSubtotal] = useState<number | null>(null);
    const [hydrated, setHydrated] = useState(false);
    const itemsRef = useRef<CartItem[]>([]);
    const loadedFor = useRef<string | null | undefined>(undefined);

    const commit = useCallback((next: CartItem[], subtotal: number | null) => {
        itemsRef.current = next;
        setItems(next);
        setTrustedSubtotal(subtotal);
    }, []);

    useEffect(() => {
        if (!authReady) return;
        let cancelled = false;

        async function hydrate() {
            if (!user) {
                const guestItems = await rehydrateCartSnapshot("guest");
                if (!cancelled) commit(guestItems, null);
                return;
            }
            try {
                const data = await apiFetch<unknown>("/cart");
                const server = normalizeSummary(data);
                if (!cancelled) commit(server.items, server.subtotal);

                const guestItems = await rehydrateCartSnapshot("guest");
                if (guestItems.length) {
                    const merged = [...server.items];
                    const uploads: Promise<unknown>[] = [];
                    for (const guestItem of guestItems) {
                        const existing = merged.find(item => sameProduct(item.product, guestItem.product));
                        const stock = existing?.product.stock ?? guestItem.product.stock;
                        if (stock <= 0) continue;
                        const desired = Math.min((existing?.quantity ?? 0) + guestItem.quantity, stock);
                        const productId = existing?.product.id ?? guestItem.product.id;
                        if (!productId) continue;
                        uploads.push(apiFetch("/cart/items", {
                            method: "POST",
                            body: JSON.stringify({ productId, quantity: desired })
                        }));
                        if (existing) {
                            existing.quantity = desired;
                            existing.lineTotal = existing.product.priceValue * desired;
                        } else {
                            merged.push(withQuantity(guestItem, desired));
                        }
                    }
                    if (uploads.length) {
                        await Promise.all(uploads);
                        removeSnapshot("guest");
                        const refreshed = normalizeSummary(await apiFetch<unknown>("/cart"));
                        if (!cancelled) commit(refreshed.items, refreshed.subtotal);
                    }
                }
            } catch (error) {
                console.error("Cart data could not be loaded", error);
                const guestItems = await rehydrateCartSnapshot("guest");
                if (!cancelled) commit(guestItems, null);
            } finally {
                if (!cancelled) {
                    loadedFor.current = user?.id ?? null;
                    setHydrated(true);
                }
            }
        }

        void hydrate();
        return () => { cancelled = true; };
    }, [authReady, user?.id, commit]);

    useEffect(() => {
        if (!hydrated || loadedFor.current !== (user?.id ?? null)) return;
        writeCart(user?.id ?? "guest", items);
    }, [items, hydrated, user?.id]);

    const applySummary = useCallback((data: unknown) => {
        const normalized = normalizeSummary(data);
        commit(normalized.items, normalized.subtotal);
        return true;
    }, [commit]);

    const applyLocally = useCallback((next: CartItem[]) => {
        commit(next, null);
        return true;
    }, [commit]);

    const removeItem = useCallback(async (slug: string) => {
        const current = itemsRef.current;
        const existing = current.find(item => item.product.slug === slug);
        if (!existing) return true;
        if (user) {
            if (!existing.product.id) return false;
            try {
                const data = await apiFetch<unknown>(`/cart/items/${existing.product.id}`, { method: "DELETE" });
                return applySummary(data);
            } catch (error) {
                console.error("Cart item could not be removed", error);
                return false;
            }
        }
        return applyLocally(current.filter(item => item.product.slug !== slug));
    }, [user, applySummary, applyLocally]);

    const addItem = useCallback(async (product: Product) => {
        const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
        if (stock <= 0) return false;

        const current = itemsRef.current;
        const existing = current.find(item => sameProduct(item.product, product));
        const desired = Math.min((existing?.quantity ?? 0) + 1, stock);
        if (existing && desired === existing.quantity) return false;

        if (user) {
            if (!product.id) return false;
            try {
                const data = await apiFetch<unknown>("/cart/items", {
                    method: "POST",
                    body: JSON.stringify({ productId: product.id, quantity: desired })
                });
                return applySummary(data);
            } catch (error) {
                console.error("Cart item could not be added", error);
                return false;
            }
        }

        const next = existing
            ? current.map(item => sameProduct(item.product, product) ? withQuantity(item, desired) : item)
            : [...current, withQuantity({ product, quantity: 0 }, desired)];
        return applyLocally(next);
    }, [user, applySummary, applyLocally]);

    const updateQty = useCallback(async (slug: string, qty: number) => {
        const current = itemsRef.current;
        const existing = current.find(item => item.product.slug === slug);
        if (!existing) return false;
        if (qty <= 0) return removeItem(slug);

        const stock = Math.max(0, Math.floor(Number(existing.product.stock) || 0));
        const desired = Math.min(Math.floor(qty), stock);
        if (desired <= 0) return removeItem(slug);
        if (desired === existing.quantity) return true;

        if (user) {
            if (!existing.product.id) return false;
            try {
                const data = await apiFetch<unknown>(`/cart/items/${existing.product.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ quantity: desired })
                });
                return applySummary(data);
            } catch (error) {
                console.error("Cart quantity could not be updated", error);
                return false;
            }
        }

        return applyLocally(current.map(item => item.product.slug === slug ? withQuantity(item, desired) : item));
    }, [user, applySummary, applyLocally, removeItem]);

    const clearCart = useCallback(async () => {
        if (user) {
            try {
                const data = await apiFetch<unknown>("/cart", { method: "DELETE" });
                return applySummary(data);
            } catch (error) {
                console.error("Cart could not be cleared", error);
                return false;
            }
        }
        return applyLocally([]);
    }, [user, applySummary, applyLocally]);

    const totalCount = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity, 0),
        [items],
    );

    const subtotal = useMemo(
        () => trustedSubtotal ?? sumLines(items),
        [trustedSubtotal, items],
    );

    const value = useMemo(
        () => ({ items, totalCount, subtotal, addItem, removeItem, clearCart, updateQty }),
        [items, totalCount, subtotal, addItem, removeItem, clearCart, updateQty],
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error("useCart must be used inside a CartProvider");
    }
    return context;
}
