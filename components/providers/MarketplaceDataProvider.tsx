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

type ApiProduct = { id: string; slug: string; name: string; description?: string | null; price: string | number; size?: string | null; stock: number; categoryId?: string | null; shop: { name: string; slug: string; verified: boolean; location?: string | null }; };
type ApiShop = { id: string; slug: string; name: string; ownerName: string; location?: string | null; tagline?: string | null; description?: string | null; verified: boolean; _count?: { products: number }; };
function toProduct(row: ApiProduct): Product {
    const priceValue = Number(row.price);
    const category = row.categoryId || defaultCategories[0].id;
    return { id: row.id, slug: row.slug, shopSlug: row.shop.slug, seller: row.shop.name, sellerManaged: true, sellerVerified: row.shop.verified, name: row.name, detail: row.size || "", price: formatNaira(priceValue), priceValue, category, art: getCategoryArt(category), glyph: "🫙", tag: "", rating: 0, reviews: 0, stock: row.stock, size: row.size || "", origin: row.shop.location || "Nigeria", description: row.description || "" };
}
function toShop(row: ApiShop, products: Product[]): Shop {
    const items = products.filter(product => product.shopSlug === row.slug);
    return { id: row.id, slug: row.slug, name: row.name, initials: row.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase(), tagline: row.tagline || "", description: row.description || "", location: row.location || "Nigeria", rating: 0, reviews: 0, verified: row.verified, categories: [...new Set(items.map(product => product.category))], specialties: [], accent: items[0]?.art || "palm", productsCount: row._count?.products ?? items.length };
}

export function useMarketplaceData() { return useContext(MarketplaceContext); }
