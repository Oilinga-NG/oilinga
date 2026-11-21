"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product, Shop } from "@/lib/data";
import { readBackendData } from "@/lib/backend-client";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { Icon } from "@/components/ui/Icon";
import { ProductGrid } from "@/components/marketplace/ProductCard";
import { ShopGrid } from "@/components/marketplace/ShopCard";
import { ShopReviews } from "@/components/marketplace/ShopReviews";
import { LiveRating, LiveRatingSummary } from "@/components/ui/LiveRating";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/components/ui/Toast";
import { LoadingState } from "@/components/ui/LoadingState";

type PublishedShop = Shop & { products: Product[] };

export function PublishedSellerShop({ mode, slug, query = "", category = "all" }: { mode: "directory" | "storefront"; slug?: string; query?: string; category?: string }) {
    const { shops, loading: marketplaceLoading, error: marketplaceError } = useMarketplaceData();
    const [shopRecord, setShopRecord] = useState<PublishedShop | null>(null);
    const [shopLoading, setShopLoading] = useState(mode === "storefront");
    const [shopError, setShopError] = useState<string | null>(null);
    const { addItem } = useCart();
    const notify = useToast();

    useEffect(() => {
        if (mode !== "storefront" || !slug) return;
        let cancelled = false;
        setShopLoading(true);
        setShopError(null);
        void readBackendData<{ shop: PublishedShop | null }>("shop", { slug })
            .then(result => { if (!cancelled) setShopRecord(result.shop); })
            .catch(requestError => { if (!cancelled) setShopError(requestError instanceof Error ? requestError.message : "Shop data could not be loaded."); })
            .finally(() => { if (!cancelled) setShopLoading(false); });
        return () => { cancelled = true; };
    }, [mode, slug]);

    if (mode === "directory") {
        if (marketplaceLoading) return <LoadingState label="Loading shops" variant="inline" />;
        if (marketplaceError) return <p className="oi-form-error" role="alert">{marketplaceError}</p>;
        const filtered = shops.filter(shop => {
            if (category !== "all" && !shop.categories.includes(category as Shop["categories"][number])) return false;
            const text = `${shop.name} ${shop.location} ${shop.tagline} ${shop.description}`.toLowerCase();
            return !query.trim() || text.includes(query.trim().toLowerCase());
        });
        return filtered.length ? <ShopGrid shops={filtered} /> : <div className="oi-empty oi-empty--card"><span className="oi-empty__icon" aria-hidden="true"><Icon name="store" size={28} /></span><h3>{shops.length ? "No shops match your filters" : "No shops are available yet"}</h3><p>{shops.length ? "Try another location or product category." : "Published seller storefronts will appear here."}</p></div>;
    }

    if (shopLoading) return <LoadingState label="Loading shop details" />;
    if (shopError) return <section className="oi-view oi-container"><div className="oi-empty oi-empty--card" role="alert"><h1>Shop could not be loaded</h1><p>{shopError}</p></div></section>;
    if (!shopRecord) return <section className="oi-view oi-container"><div className="oi-empty oi-empty--card"><h1>Shop not found</h1><p>This shop is not available in the marketplace.</p><Link className="oi-btn oi-btn--primary oi-btn--sm" href="/shops">Browse shops</Link></div></section>;
    const shop = shopRecord;
    const products = shop.products ?? [];

    return <section className="oi-view oi-container" aria-labelledby="published-shop-title">
        <div className="oi-storefront"><span className={`oi-storefront__mark oi-storefront__mark--${shop.accent}`} aria-hidden="true">{shop.initials}</span><div className="oi-storefront__intro">
            <div className="oi-storefront__flags"><span className={`oi-badge ${shop.verified ? "oi-badge--green" : "oi-badge--neutral"}`}>{shop.verified ? "Verified seller" : "Seller listed"}</span></div>
            <h1 id="published-shop-title" className="oi-storefront__title">{shop.name}</h1><p className="oi-storefront__tagline">{shop.tagline}</p><div className="oi-storefront__meta"><span><Icon name="pin" size={14} />{shop.location}</span><LiveRating targetType="shop" targetId={shop.slug} fallback={{ rating: shop.rating, reviews: shop.reviews }} /></div><p className="oi-storefront__description">{shop.description}</p>
        </div><div className="oi-storefront__stats"><div><strong>{products.length}</strong><small>{products.length === 1 ? "Product" : "Products"}</small></div><div><LiveRatingSummary targetType="shop" targetId={shop.slug} fallback={{ rating: shop.rating, reviews: shop.reviews }} /></div></div></div>
        <div id="shop-products" className="oi-storefront__section"><div className="oi-section__head"><div><span className="oi-eyebrow oi-eyebrow--green">Straight from the producer</span><h2 className="oi-section__title">Products from {shop.name}</h2></div></div>
            {products.length ? <ProductGrid products={products} compact /> : <div className="oi-empty oi-empty--card"><h3>No active products right now</h3><p>This seller has not published any active products.</p></div>}
        </div>
        <ShopReviews shopSlug={shop.slug} shopName={shop.name} />
    </section>;
}
