"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Product, Shop } from "@/lib/data";
import { readBackendData } from "@/lib/backend-client";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { AddToCart } from "@/components/marketplace/AddToCart";
import { ProductGrid } from "@/components/marketplace/ProductCard";
import { ProductReviews } from "@/components/marketplace/ProductReviews";
import { ShopCard } from "@/components/marketplace/ShopCard";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { LiveRating } from "@/components/ui/LiveRating";
import { cn } from "@/lib/cn";
import { LoadingState } from "@/components/ui/LoadingState";

export function ProductDetailView({ slug }: { slug: string }) {
    const [product, setProduct] = useState<Product | null>(null);
    const [shop, setShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { products, categories } = useMarketplaceData();
    const categoryName = categories.find(category => category.id === product?.category)?.name ?? "Oils";

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void readBackendData<{ product: Product | null; shop: Shop | null }>("product", { slug })
            .then(result => { if (!cancelled) { setProduct(result.product); setShop(result.shop); } })
            .catch(requestError => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Product data could not be loaded."); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [slug]);

    const related = useMemo(() => product ? products.filter(item => item.slug !== product.slug && item.category === product.category).slice(0, 4) : [], [product, products]);
    if (loading) return <LoadingState label="Loading product details" />;
    if (error) return <section className="oi-view oi-container"><div className="oi-empty oi-empty--card" role="alert"><h1>Product could not be loaded</h1><p>{error}</p></div></section>;
    if (!product) return <section className="oi-view oi-container"><div className="oi-empty oi-empty--card"><h1>Product not found</h1><p>This product is not currently published in the marketplace.</p><ButtonLink href="/marketplace" variant="primary" size="sm">Browse marketplace</ButtonLink></div></section>;
    const lowStock = product.stock <= 6;

    return <section className="oi-view oi-container" aria-labelledby="product-title">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Marketplace", href: "/marketplace" }, { label: product.name }]} />
        <div className="oi-pdp">
            <div className={cn("oi-pdp__media", `oi-pdp__media--${product.art}`)}><Badge tone="neutral" className="oi-pdp__tag">{product.tag}</Badge><span className="oi-pdp__glyph" aria-hidden="true">{product.glyph}</span><span className="oi-pdp__size-badge">{product.size}</span></div>
            <div className="oi-pdp__info">
                <span className="oi-eyebrow oi-eyebrow--green">{categoryName}</span>
                <h1 id="product-title" className="oi-pdp__title">{product.name}</h1>
                <div className="oi-pdp__rating"><LiveRating targetType="product" targetId={product.slug} fallback={{ rating: product.rating, reviews: product.reviews }} />{shop && <span>Sold by <Link href={`/shops/${shop.slug}`}>{shop.name}</Link></span>}</div>
                <div className="oi-pdp__price-row"><strong className="oi-pdp__price">{product.price}</strong><Badge tone={lowStock ? "pending" : "green"}>{product.stock === 0 ? "Out of stock" : lowStock ? `Only ${product.stock} left` : "In stock"}</Badge></div>
                <p className="oi-pdp__description">{product.description}</p>
                <dl className="oi-pdp__facts"><div><dt>Size</dt><dd>{product.size}</dd></div><div><dt>Origin</dt><dd>{product.origin}</dd></div><div><dt>Category</dt><dd>{categoryName}</dd></div><div><dt>Available</dt><dd>{product.stock} units</dd></div></dl>
                <AddToCart product={product} />
                <ul className="oi-pdp__assurances"><li><Icon name="truck" size={16} />Delivered from {product.origin}</li><li><Icon name="shield" size={16} />Secure checkout and buyer protection</li><li><Icon name="headset" size={16} />Support from the Oilinga team</li></ul>
            </div>
        </div>
        {shop && <div className="oi-pdp__shop"><div><span className="oi-eyebrow oi-eyebrow--green">The producer</span><h2>Meet {shop.name}</h2><p>{shop.tagline}</p></div><ShopCard shop={shop} /></div>}
        {related.length > 0 && <Section eyebrow="You might also like" title="Related products" action={<Link className="oi-section__action" href="/marketplace">See all products →</Link>}><ProductGrid products={related} /></Section>}
        <ProductReviews productSlug={product.slug} productName={product.name} />
        <div className="oi-pdp__back"><ButtonLink href="/marketplace" variant="outline" size="sm"><Icon name="arrow-left" size={14} />Back to marketplace</ButtonLink></div>
    </section>;
}
