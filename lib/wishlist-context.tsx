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
import { mapProduct } from "@/lib/backend-mappers";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";

const WISHLIST_KEY = "oilinga.wishlist";

interface WishlistContextValue {
    items: WishlistItem[];
    addToWishlist: (product: Product) => Promise<boolean>;
    removeFromWishlist: (slug: string) => Promise<boolean>;
    isInWishlist: (slug: string) => boolean;
    toggleWishlist: (product: Product) => Promise<boolean>;
}

type Row = Record<string, any>;

const WishlistContext = createContext<WishlistContextValue | null>(null);

function snapshotKey(identity: string) {
    return `${WISHLIST_KEY}:${identity}`;
}

function sameProduct(left: Product, right: Product): boolean {
    if (left.id && right.id) return left.id === right.id;
    return left.slug === right.slug;
}

function normalizeWishlist(data: unknown): WishlistItem[] {
    if (!Array.isArray(data)) return [];
    return (data as Row[])
        .map(row => ({ product: mapProduct(row.product ?? row) }))
        .filter(item => item.product.slug || item.product.id);
}

function readWishlist(identity: string): WishlistItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(snapshotKey(identity))
            ?? (identity === "guest" ? window.localStorage.getItem("oilinga_wishlist") : null);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return normalizeWishlist(parsed);
    } catch {
        return [];
    }
}

function writeWishlist(identity: string, items: WishlistItem[]) {
    try {
        window.localStorage.setItem(snapshotKey(identity), JSON.stringify(items));
    } catch {
        // Storage may be unavailable in private browsing; in-memory state still works.
    }
}

function removeSnapshot(identity: string) {
    try {
        window.localStorage.removeItem(snapshotKey(identity));
        if (identity === "guest") window.localStorage.removeItem("oilinga_wishlist");
    } catch {
        // Ignore storage failures.
    }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
    const { user, ready: authReady } = useAuth();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const itemsRef = useRef<WishlistItem[]>([]);
    const loadedFor = useRef<string | null | undefined>(undefined);

    const commit = useCallback((next: WishlistItem[]) => {
        itemsRef.current = next;
        setItems(next);
    }, []);

    useEffect(() => {
        if (!authReady) return;
        let cancelled = false;
        const identity = user?.id ?? "guest";

        async function hydrate() {
            if (!user) {
                if (!cancelled) commit(readWishlist("guest"));
                return;
            }
            try {
                const remote = normalizeWishlist(await apiFetch<unknown>("/wishlist"));
                if (!cancelled) commit(remote);

                const guestItems = readWishlist("guest");
                const uploads: Promise<unknown>[] = [];
                for (const guestItem of guestItems) {
                    if (!guestItem.product.id) continue;
                    if (remote.some(item => sameProduct(item.product, guestItem.product))) continue;
                    uploads.push(apiFetch("/wishlist/items", {
                        method: "POST",
                        body: JSON.stringify({ productId: guestItem.product.id })
                    }));
                }
                if (uploads.length) {
                    await Promise.all(uploads);
                    removeSnapshot("guest");
                    const refreshed = normalizeWishlist(await apiFetch<unknown>("/wishlist"));
                    if (!cancelled) commit(refreshed);
                }
            } catch (error) {
                console.error("Wishlist data could not be loaded", error);
                if (!cancelled) commit(readWishlist(identity));
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
        writeWishlist(user?.id ?? "guest", items);
    }, [items, hydrated, user?.id]);

    const applyList = useCallback((data: unknown) => {
        commit(normalizeWishlist(data));
        return true;
    }, [commit]);

    const addToWishlist = useCallback(async (product: Product) => {
        if (itemsRef.current.some(item => sameProduct(item.product, product))) return true;
        if (user) {
            if (!product.id) return false;
            try {
                const data = await apiFetch<unknown>("/wishlist/items", {
                    method: "POST",
                    body: JSON.stringify({ productId: product.id })
                });
                return applyList(data);
            } catch (error) {
                console.error("Wishlist item could not be added", error);
                return false;
            }
        }
        commit([...itemsRef.current, { product }]);
        return true;
    }, [user, applyList, commit]);

    const removeFromWishlist = useCallback(async (slug: string) => {
        const current = itemsRef.current;
        const existing = current.find(item => item.product.slug === slug);
        if (!existing) return true;
        if (user) {
            if (!existing.product.id) return false;
            try {
                const data = await apiFetch<unknown>(`/wishlist/items/${existing.product.id}`, { method: "DELETE" });
                return applyList(data);
            } catch (error) {
                console.error("Wishlist item could not be removed", error);
                return false;
            }
        }
        commit(current.filter(item => item.product.slug !== slug));
        return true;
    }, [user, applyList, commit]);

    const isInWishlist = useCallback(
        (slug: string) => items.some(item => item.product.slug === slug),
        [items],
    );

    const toggleWishlist = useCallback(async (product: Product) => {
        if (itemsRef.current.some(item => sameProduct(item.product, product))) {
            return removeFromWishlist(product.slug);
        }
        return addToWishlist(product);
    }, [addToWishlist, removeFromWishlist]);

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
