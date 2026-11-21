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
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";

/** A single line-item in the shopping cart. */
export interface CartItem {
    product: Product;
    quantity: number;
}

interface CartContextValue {
    items: CartItem[];
    totalCount: number;
    addItem: (product: Product) => void;
    removeItem: (slug: string) => void;
    clearCart: () => void;
    updateQty: (slug: string, qty: number) => void;
}

const CART_KEY = "oilinga.cart";

export const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
    try {
        const raw = window.localStorage.getItem(CART_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
    } catch {
        return [];
    }
}

function writeCart(items: CartItem[]) {
    try {
        window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
        // Storage may be unavailable in private browsing; in-memory state still works.
    }
}

export function CartProvider({ children }: { children: ReactNode }) {
    const { user, ready: authReady } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const loadedFor = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (!authReady) return;
        let cancelled = false;
        const identity = user?.id ?? null;
        async function hydrate() {
            try {
                if (!user) {
                    if (!cancelled) setItems(readCart());
                } else {
                    const result = await apiFetch<{ id: string; quantity: number; product: { id: string; slug: string; name: string; price: string | number; stock: number; size?: string | null; categoryId?: string | null; description?: string | null; shop: { name: string; slug: string; verified: boolean; location?: string | null } } }[]>("/cart");
                    const merged: CartItem[] = result.map(row => {
                        const priceValue = Number(row.product.price);
                        return { quantity: row.quantity, product: { id: row.product.id, slug: row.product.slug, name: row.product.name, shopSlug: row.product.shop.slug, seller: row.product.shop.name, detail: row.product.size || "", size: row.product.size || "", price: `₦${priceValue.toLocaleString("en-NG")}`, priceValue, stock: row.product.stock, category: row.product.categoryId || "crude-palm", art: "palm", glyph: "🫙", tag: "", rating: 0, reviews: 0, origin: row.product.shop.location || "Nigeria", description: row.product.description || "", sellerManaged: true, sellerVerified: row.product.shop.verified } };
                    });
                    for (const oldItem of readCart()) {
                        const existing = merged.find(item => item.product.slug === oldItem.product.slug);
                        if (existing) existing.quantity += oldItem.quantity;
                        else merged.push(oldItem);
                    }
                    if (!cancelled) setItems(merged);
                }
            } catch (error) {
                console.error("Cart data could not be loaded", error);
                if (!cancelled) setItems(readCart());
            } finally {
                if (!cancelled) { loadedFor.current = identity; setHydrated(true); }
            }
        }
        void hydrate();
        return () => { cancelled = true; };
    }, [authReady, user?.id]);

    useEffect(() => {
        if (!hydrated || loadedFor.current !== (user?.id ?? null)) return;
        if (!user) { writeCart(items); return; }
        const timer = window.setTimeout(() => {
            void Promise.all(items.filter(item => item.product.id).map(item => apiFetch("/cart/items", { method: "POST", body: JSON.stringify({ productId: item.product.id, quantity: item.quantity }) }))).then(() => localStorage.removeItem(CART_KEY)).catch(error => console.error("Cart data could not be saved", error));
        }, 180);
        return () => window.clearTimeout(timer);
    }, [items, hydrated, user?.id]);

    const addItem = useCallback((product: Product) => {
        setItems((prev) => {
            const existing = prev.find((item) => item.product.slug === product.slug);
            if (existing) {
                return prev.map((item) =>
                    item.product.slug === product.slug
                        ? { ...item, quantity: item.quantity + 1 }
                        : item,
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    }, []);

    const removeItem = useCallback((slug: string) => {
        const removed = items.find(item => item.product.slug === slug);
        setItems((prev) => prev.filter((item) => item.product.slug !== slug));
        if (user && removed?.product.id) void apiFetch(`/cart/items/${removed.product.id}`, { method: "DELETE" }).catch(error => console.error("Cart item could not be removed", error));
    }, [items, user]);

    const clearCart = useCallback(() => {
        setItems([]);
        if (user) void apiFetch("/cart", { method: "DELETE" }).catch(error => console.error("Cart could not be cleared", error));
    }, [user]);

    const updateQty = useCallback((slug: string, qty: number) => {
        if (qty <= 0) {
            const removed = items.find(item => item.product.slug === slug);
            setItems((prev) => prev.filter((item) => item.product.slug !== slug));
            if (user && removed?.product.id) void apiFetch(`/cart/items/${removed.product.id}`, { method: "DELETE" }).catch(error => console.error("Cart item could not be removed", error));
        } else {
            setItems((prev) =>
                prev.map((item) =>
                    item.product.slug === slug ? { ...item, quantity: qty } : item,
                ),
            );
        }
    }, [items, user]);

    const totalCount = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity, 0),
        [items],
    );

    const value = useMemo(
        () => ({ items, totalCount, addItem, removeItem, clearCart, updateQty }),
        [items, totalCount, addItem, removeItem, clearCart, updateQty],
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
