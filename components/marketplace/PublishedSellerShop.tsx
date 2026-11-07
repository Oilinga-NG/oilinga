"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product, Shop } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/components/ui/Toast";
import { ProductGrid } from "@/components/marketplace/ProductCard";

const STORAGE_KEY = "oilinga-seller-shop-v1";
type SavedShop = { shop: string; owner: string; location: string; tagline: string; published: boolean; products: { id?: string; name: string; price: string; size: string; stock: string; status?: string }[] };

function slugify(value: string) {
    return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toShop(saved: SavedShop): Shop {
    const initials = saved.shop.trim().split(/\s+/).map(word => word[0]).slice(0, 2).join("").toUpperCase();
    return {
        slug: slugify(saved.shop), name: saved.shop, initials, tagline: saved.tagline || `Quality oils from ${saved.shop}.`,
        description: `${saved.shop} is a local producer based in ${saved.location}. Browse products listed directly by the seller.`,
        location: saved.location, since: new Date().getFullYear(), rating: 0, reviews: 0, verified: false,
        categories: ["crude-palm"], specialties: ["Locally produced oils"], accent: "palm",
    };
}

function toProduct(item: SavedShop["products"][number], saved: SavedShop, shop: Shop, index: number): Product {
    const priceValue = Number(item.price) || 0;
    return {
        slug: `${shop.slug}-${slugify(item.name)}-${item.id || index + 1}`, shopSlug: shop.slug, seller: saved.shop,
        name: item.name, detail: `${item.size} · ${item.stock} in stock`, price: `₦${priceValue.toLocaleString("en-NG")}`,
        priceValue, category: "crude-palm", art: "palm", glyph: "🫒", tag: "Seller listed", rating: 0, reviews: 0,
        stock: Number(item.stock) || 0, size: item.size, origin: saved.location, description: item.name,
        sellerManaged: true,
    };
}

export function PublishedSellerProducts({ baseProducts, query = "", category = "all", categoryLabel, min, max, sort = "recommended", verified = false }: {
    baseProducts: Product[]; query?: string; category?: string; categoryLabel?: string; min?: number; max?: number; sort?: string; verified?: boolean;
}) {
    const [saved, setSaved] = useState<SavedShop | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as SavedShop;
                if (parsed.published) setSaved(parsed);
            }
        } catch { /* Ignore invalid local seller data. */ }
        setReady(true);
    }, []);

    const shop = ready && saved ? toShop(saved) : null;
    const q = query.trim().toLowerCase();
    const sellerProducts = shop && saved && !verified ? saved.products
        .filter(item => item.status !== "Draft")
        .map((item, index) => toProduct(item, saved, shop, index))
        .filter(item => category === "all" || item.category === category)
        .filter(item => min === undefined || item.priceValue >= min)
        .filter(item => max === undefined || item.priceValue <= max)
        .filter(item => !q || `${item.name} ${item.detail} ${item.seller} ${item.origin}`.toLowerCase().includes(q)) : [];

    if (sort === "price-asc") sellerProducts.sort((a, b) => a.priceValue - b.priceValue);
    if (sort === "price-desc") sellerProducts.sort((a, b) => b.priceValue - a.priceValue);
    const products = [...baseProducts, ...sellerProducts];
    if (sort === "price-asc") products.sort((a, b) => a.priceValue - b.priceValue);
    if (sort === "price-desc") products.sort((a, b) => b.priceValue - a.priceValue);

    return <><div className="oi-result-bar"><span>Showing <b>{products.length}</b> {products.length === 1 ? "product" : "products"}{categoryLabel && category !== "all" && <> in <b>{categoryLabel}</b></>}{query && <> for <b>“{query}”</b></>}</span></div>{products.length ? <ProductGrid products={products} compact /> : <div className="oi-empty oi-empty--card"><span className="oi-empty__icon" aria-hidden="true"><Icon name="search" size={28} /></span><h3>No products match those filters</h3><p>Try a different search term, widen the price range, or clear the filters to see the whole marketplace.</p><Link className="oi-btn oi-btn--primary oi-btn--sm" href="/marketplace">Clear filters</Link></div>}</>;
}

export function PublishedSellerShop({ mode, slug, query = "" }: { mode: "directory" | "storefront"; slug?: string; query?: string }) {
    const [saved, setSaved] = useState<SavedShop | null>(null);
    const [ready, setReady] = useState(false);
    const { addItem } = useCart();
    const notify = useToast();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as SavedShop;
                if (parsed.published) setSaved(parsed);
            }
        } catch { /* Ignore invalid local seller data. */ }
        setReady(true);
    }, []);

    if (!ready) return <section className="oi-view oi-container"><p>Loading shop…</p></section>;
    if (!saved) return mode === "directory" ? null : <section className="oi-view oi-container"><div className="oi-empty oi-empty--card"><h1>Shop not found</h1><p>This shop is not available in this browser.</p><Link className="oi-btn oi-btn--primary oi-btn--sm" href="/shops">Browse shops</Link></div></section>;
    const shop = toShop(saved);
    if (slug && slug !== shop.slug) return <section className="oi-view oi-container"><div className="oi-empty oi-empty--card"><h1>Shop not found</h1><p>This shop is not available in this browser.</p><Link className="oi-btn oi-btn--primary oi-btn--sm" href="/shops">Browse shops</Link></div></section>;
    const products = saved.products.filter(item => item.status !== "Draft").map((item, index) => toProduct(item, saved, shop, index));
    if (mode === "directory" && query.trim()) {
        const haystack = `${shop.name} ${shop.location} ${shop.tagline} ${products.map(item => item.name).join(" ")}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return null;
    }

    if (mode === "directory") {
        return (
            <article className="oi-shop-card oi-published-shop-card">
                <Link href={`/shops/${shop.slug}`} className="oi-shop-card__head" aria-label={`Visit ${shop.name}`}>
                    <span className="oi-shop-card__mark oi-shop-card__mark--palm" aria-hidden="true">{shop.initials}</span>
                    <span className="oi-shop-card__title"><strong>{shop.name}</strong></span>
                </Link>
                <p className="oi-shop-card__tagline">{shop.tagline}</p>
                <div className="oi-shop-card__meta"><Icon name="pin" size={13} /><span>{shop.location}</span></div>
                <div className="oi-shop-card__footer"><span className="oi-shop-card__count">{products.length} {products.length === 1 ? "product" : "products"}</span><span>Published shop</span></div>
            </article>
        );
    }

    return (
        <section className="oi-view oi-container" aria-labelledby="published-shop-title">
            <div className="oi-storefront">
                <span className="oi-storefront__mark oi-storefront__mark--palm" aria-hidden="true">{shop.initials}</span>
                <div className="oi-storefront__intro">
                    <div className="oi-storefront__flags"><span className="oi-badge oi-badge--neutral">Seller listed</span></div>
                    <h1 id="published-shop-title" className="oi-storefront__title">{shop.name}</h1>
                    <p className="oi-storefront__tagline">{shop.tagline}</p>
                    <div className="oi-storefront__meta"><span><Icon name="pin" size={14} />{shop.location}</span></div>
                    <p className="oi-storefront__description">{shop.description}</p>
                </div>
                <div className="oi-storefront__stats"><div><strong>{products.length}</strong><small>{products.length === 1 ? "Product" : "Products"}</small></div><div><strong>—</strong><small>Shop rating</small></div><div><strong>0</strong><small>Reviews</small></div></div>
            </div>
            <div id="shop-products" className="oi-storefront__section">
                <div className="oi-section__head"><div><span className="oi-eyebrow oi-eyebrow--green">Straight from the producer</span><h2 className="oi-section__title">Products from {shop.name}</h2></div></div>
                {products.length ? <div className="oi-product-grid oi-product-grid--compact">{products.map(product => <article className="oi-product-card" key={product.slug}><div className="oi-product-card__art oi-product-card__art--palm"><span className="oi-product-card__glyph" aria-hidden="true">{product.glyph}</span></div><div className="oi-product-card__body"><span className="oi-product-card__seller">{shop.name}</span><h3 className="oi-product-card__name">{product.name}</h3><p className="oi-product-card__meta">{product.detail}</p><div className="oi-product-card__footer"><strong className="oi-product-card__price">{product.price}</strong><button type="button" className="oi-add-btn" aria-label={`Add ${product.name} to cart`} disabled={!product.stock} onClick={() => { addItem(product); notify(`${product.name} added to your cart`); }}><Icon name="plus" size={18} /></button></div></div></article>)}</div> : <div className="oi-empty oi-empty--card"><h3>No active products right now</h3><p>This seller has not published any active products.</p></div>}
            </div>
        </section>
    );
}
