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
import type { WishlistItem } from "./types";
import { apiFetch } from "@/lib/api-client";
import { mapProduct } from "@/lib/backend-mappers";
import { useAuth } from "@/components/auth/AuthProvider";

const WISHLIST_KEY = "oilinga_wishlist";

interface WishlistContextValue {
    items: WishlistItem[];
    addToWishlist: (product: Product) => void;
    removeFromWishlist: (slug: string) => void;
    isInWishlist: (slug: string) => boolean;
    toggleWishlist: (product: Product) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readWishlist(): WishlistItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(WISHLIST_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as WishlistItem[]) : [];
    } catch {
        return [];
    }
}

function writeWishlist(items: WishlistItem[]): void {
    try {
        window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    } catch {
        // Storage may be unavailable in private browsing; in-memory state still works.
    }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
    const { user, ready: authReady } = useAuth();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const loadedFor = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (!authReady) return;
        let cancelled = false;
        const identity = user?.id ?? null;
        async function hydrate() {
            try {
                if (!user) {
                    if (!cancelled) setItems(readWishlist());
                } else {
                    const remote = await apiFetch<{ product: Record<string, unknown> }[]>("/wishlist");
                    const merged: WishlistItem[] = remote.map(row => ({ product: mapProduct(row.product) }));
                    for (const oldItem of readWishlist()) if (!merged.some(item => item.product.slug === oldItem.product.slug)) merged.push(oldItem);
                    if (!cancelled) setItems(merged);
                }
            } catch (error) {
                console.error("Wishlist data could not be loaded", error);
                if (!cancelled) setItems(readWishlist());
            } finally { if (!cancelled) { loadedFor.current = identity; setHydrated(true); } }
        }
        void hydrate();
        return () => { cancelled = true; };
    }, [authReady, user?.id]);

    useEffect(() => {
        if (!hydrated || loadedFor.current !== (user?.id ?? null)) return;
        if (!user) { writeWishlist(items); return; }
        const timer = window.setTimeout(() => {
            void apiFetch("/wishlist", { method: "PUT", body: JSON.stringify({ productIds: items.map(item => item.product.id).filter(Boolean) }) }).then(() => localStorage.removeItem(WISHLIST_KEY)).catch(error => console.error("Wishlist data could not be saved", error));
        }, 180);
        return () => window.clearTimeout(timer);
    }, [items, hydrated, user?.id]);

    const addToWishlist = useCallback((product: Product) => {
        setItems((prev) => {
            const exists = prev.some((item) => item.product.slug === product.slug);
            if (exists) return prev;
            return [...prev, { product }];
        });
    }, []);

    const removeFromWishlist = useCallback((slug: string) => {
        setItems((prev) => prev.filter((item) => item.product.slug !== slug));
    }, []);

    const isInWishlist = useCallback(
        (slug: string) => items.some((item) => item.product.slug === slug),
        [items],
    );

    const toggleWishlist = useCallback(
        (product: Product) => {
            setItems((prev) => {
                const exists = prev.some((item) => item.product.slug === product.slug);
                if (exists) {
                    return prev.filter((item) => item.product.slug !== product.slug);
                }
                return [...prev, { product }];
            });
        },
        [],
    );

    const value = useMemo(
        () => ({ items, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist }),
        [items, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist],
    );

    return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error("useWishlist must be used inside a WishlistProvider");
    }
    return context;
}
