"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";
import { readBackendData } from "@/lib/backend-client";
import { mapProduct } from "@/lib/backend-mappers";
import type { Category, Product, Shop } from "@/lib/data";

interface MarketplaceData { products: Product[]; shops: Shop[]; categories: Category[]; loading: boolean; error: string | null; refresh: () => Promise<void>; }
const MarketplaceContext = createContext<MarketplaceData>({ products: [], shops: [], categories: [], loading: true, error: null, refresh: async () => {} });

export function MarketplaceDataProvider({ children }: { children: ReactNode }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [shops, setShops] = useState<Shop[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // All row -> Product/Shop/Category adaptation lives in the backend
            // compatibility layer (readBackendData + lib/backend-mappers).
            const data = await readBackendData<{ products: Product[]; shops: Shop[]; categories: Category[] }>("marketplace");
            setProducts(data.products);
            setShops(data.shops);
            setCategories(data.categories);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Marketplace data could not be loaded.");
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    const value = useMemo(() => ({ products, shops, categories, loading, error, refresh }), [products, shops, categories, loading, error, refresh]);
    return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplaceData() { return useContext(MarketplaceContext); }

export type ProductQuery = {
    search?: string;
    category?: string;
    shop?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: "recommended" | "price-asc" | "price-desc" | "newest" | "name-asc";
    page?: number;
    limit?: number;
};

export type ProductPagination = { page: number; limit: number; total: number; pages: number };

/** Server-backed product search so filtering and pagination come from the API. */
export function useMarketplaceProductSearch(query: ProductQuery) {
    const key = JSON.stringify(query);
    const [products, setProducts] = useState<Product[]>([]);
    const [pagination, setPagination] = useState<ProductPagination>({ page: 1, limit: 12, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const current = JSON.parse(key) as ProductQuery;
        const params = new URLSearchParams();
        if (current.search) params.set("search", current.search);
        if (current.category) params.set("category", current.category);
        if (current.shop) params.set("shop", current.shop);
        if (current.minPrice !== undefined) params.set("minPrice", String(current.minPrice));
        if (current.maxPrice !== undefined) params.set("maxPrice", String(current.maxPrice));
        if (current.sort && current.sort !== "recommended") params.set("sort", current.sort);
        params.set("page", String(current.page ?? 1));
        params.set("limit", String(current.limit ?? 12));

        setLoading(true);
        setError(null);
        apiFetch<{ items: Record<string, unknown>[]; pagination: ProductPagination }>(`/products?${params}`)
            .then(result => {
                if (cancelled) return;
                setProducts(result.items.map(mapProduct));
                setPagination(result.pagination);
            })
            .catch(requestError => {
                if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Products could not be loaded.");
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [key]);

    return { products, pagination, loading, error };
}
