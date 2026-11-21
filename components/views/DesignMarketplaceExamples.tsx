"use client";

import { ProductGrid } from "@/components/marketplace/ProductCard";
import { ShopGrid } from "@/components/marketplace/ShopCard";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { LoadingState } from "@/components/ui/LoadingState";

export function DesignMarketplaceExamples() {
    const { products, shops, loading, error } = useMarketplaceData();
    if (loading) return <LoadingState label="Loading published marketplace records" variant="inline" />;
    if (error) return <p className="oi-form-error" role="alert">Marketplace examples could not be loaded: {error}</p>;
    return <>
        {products.length ? <ProductGrid products={products.slice(0, 3)} compact /> : <p className="oi-muted">No published products are available yet.</p>}
        {shops.length ? <ShopGrid shops={shops.slice(0, 3)} /> : <p className="oi-muted">No published shops are available yet.</p>}
    </>;
}
