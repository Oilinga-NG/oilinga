"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";
import { defaultCategories, formatNaira, getCategoryArt, type Category, type Product, type Shop } from "@/lib/data";

interface MarketplaceData { products: Product[]; shops: Shop[]; categories: Category[]; loading: boolean; error: string | null; refresh: () => Promise<void>; }
const MarketplaceContext = createContext<MarketplaceData>({ products: [], shops: [], categories: defaultCategories, loading: true, error: null, refresh: async () => {} });

export function MarketplaceDataProvider({ children }: { children: ReactNode }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [shops, setShops] = useState<Shop[]>([]);
    const [categories, setCategories] = useState<Category[]>(defaultCategories);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [productRows, shopRows, categoryRows] = await Promise.all([
                apiFetch<{ items: ApiProduct[] }>("/products?limit=100"),
                apiFetch<ApiShop[]>("/shops"),
                apiFetch<Category[]>("/products/categories"),
            ]);
            const nextProducts = productRows.items.map(toProduct);
            setProducts(nextProducts);
            setShops(shopRows.map(shop => toShop(shop, nextProducts)));
            setCategories(categoryRows.length ? categoryRows : defaultCategories);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Marketplace data could not be loaded.");
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    const value = useMemo(() => ({ products, shops, categories, loading, error, refresh }), [products, shops, categories, loading, error, refresh]);
    return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

type ApiProduct = { id: string; slug: string; name: string; description?: string | null; price: string | number; size?: string | null; stock: number; categoryId?: string | null; status?: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK"; imageUrl?: string | null; media?: { id: string; url: string; alt?: string | null }[]; shop: { name: string; slug: string; verified: boolean; location?: string | null }; };
type ApiShop = { id: string; slug: string; name: string; ownerName: string; location?: string | null; tagline?: string | null; description?: string | null; verified: boolean; _count?: { products: number }; };
function toProduct(row: ApiProduct): Product {
    const priceValue = Number(row.price);
    const category = row.categoryId || defaultCategories[0].id;
    return { id: row.id, slug: row.slug, shopSlug: row.shop.slug, seller: row.shop.name, sellerManaged: true, sellerVerified: row.shop.verified, name: row.name, detail: row.size || "", price: formatNaira(priceValue), priceValue, category, art: getCategoryArt(category), glyph: "🫙", tag: "", rating: 0, reviews: 0, stock: row.stock, size: row.size || "", origin: row.shop.location || "Nigeria", description: row.description || "", status: row.status, imageUrl: row.imageUrl ?? null, media: row.media ?? [] };
}
function toShop(row: ApiShop, products: Product[]): Shop {
    const items = products.filter(product => product.shopSlug === row.slug);
    return { id: row.id, slug: row.slug, name: row.name, initials: row.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase(), tagline: row.tagline || "", description: row.description || "", location: row.location || "Nigeria", rating: 0, reviews: 0, verified: row.verified, categories: [...new Set(items.map(product => product.category))], specialties: [], accent: items[0]?.art || "palm", productsCount: row._count?.products ?? items.length };
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
        apiFetch<{ items: ApiProduct[]; pagination: ProductPagination }>(`/products?${params}`)
            .then(result => {
                if (cancelled) return;
                setProducts(result.items.map(toProduct));
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
