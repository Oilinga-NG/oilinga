"use client";

import Link from "next/link";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { CategoryGrid } from "@/components/marketplace/CategoryGrid";
import { ProductGrid } from "@/components/marketplace/ProductCard";
import { SellerBanner } from "@/components/marketplace/SellerBanner";
import { ShopGrid } from "@/components/marketplace/ShopCard";
import { RouteSearch } from "@/components/marketplace/RouteSearch";
import { TrustRow } from "@/components/marketplace/TrustRow";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { LoadingState } from "@/components/ui/LoadingState";

export function HomeView() {
    const { products, shops, categories, loading, error } = useMarketplaceData();
    const popularSearches = categories.map(category => category.name);
    const featuredProducts = products.slice(0, 4);
    const featuredShops = shops.slice(0, 4);
    return (
        <div className="oi-view oi-container">
            <section className="oi-hero" aria-labelledby="hero-title">
                <div className="oi-hero__copy">
                    <span className="oi-eyebrow">Africa’s marketplace for quality oils</span>
                    <h1 id="hero-title" className="oi-hero__title">
                        Buy, sell and grow{" "}
                        <br />
                        with <em>Oilinga</em>
                    </h1>
                    <p className="oi-hero__lede">
                        Connecting palm oil and groundnut oil sellers, retailers and consumers
                        across Africa.
                    </p>
                    <div className="oi-hero__search">
                        <RouteSearch
                            basePath="/marketplace"
                            size="lg"
                            placeholder="Search oils, shops or locations…"
                            label="Search the marketplace"
                        />
                    </div>
                    <div className="oi-hero__actions">
                        <ButtonLink href="/marketplace" variant="gold">
                            Start shopping
                            <Icon name="arrow-right" size={16} />
                        </ButtonLink>
                        <ButtonLink href="/seller" variant="glass">
                            Become a seller
                        </ButtonLink>
                    </div>
                    <div className="oi-hero__proof">
                        <span>✦ Verified local sellers</span>
                        <span>✦ Secure checkout</span>
                    </div>
                </div>
                <div className="oi-hero__photo">
                    <Image
                        src="/assets/background/havest.png"
                        alt="Palm oil harvest"
                        fill
                        style={{ objectFit: "cover", objectPosition: "center" }}
                        priority
                    />
                </div>
            </section>

            <div className="oi-popular">
                <span className="oi-popular__label">Popular right now</span>
                {popularSearches.map((term) => (
                    <Link
                        key={term}
                        href={`/marketplace?q=${encodeURIComponent(term)}`}
                        className="oi-popular__chip"
                    >
                        {term}
                    </Link>
                ))}
            </div>

            <TrustRow />

            <Section
                eyebrow="Explore the marketplace"
                title="Shop by category"
                action={
                    <Link className="oi-section__action" href="/marketplace">
                        Browse all products →
                    </Link>
                }
            >
                <CategoryGrid categories={categories} />
            </Section>

            <Section
                eyebrow="Meet the makers"
                title="Shops to know"
                action={
                    <Link className="oi-section__action" href="/shops">
                        View the shop directory →
                    </Link>
                }
            >
                {loading ? <LoadingState label="Loading shops" variant="inline" /> : error ? <p className="oi-muted" role="alert">Shop data could not be loaded.</p> : featuredShops.length ? <ShopGrid shops={featuredShops} /> : <div className="oi-empty oi-empty--card"><h3>No shops yet</h3><p>Seller storefronts will appear here after they publish products.</p></div>}
            </Section>

            <Section
                eyebrow="Picked for you"
                title="Featured products"
                action={
                    <Link className="oi-section__action" href="/marketplace">
                        Explore marketplace →
                    </Link>
                }
            >
                {loading ? <LoadingState label="Loading products" variant="inline" /> : error ? <p className="oi-muted" role="alert">Product data could not be loaded.</p> : featuredProducts.length ? <ProductGrid products={featuredProducts} /> : <div className="oi-empty oi-empty--card"><h3>No products yet</h3><p>Products will appear here when sellers publish their shops.</p></div>}
            </Section>

            <SellerBanner />
        </div>
    );
}
