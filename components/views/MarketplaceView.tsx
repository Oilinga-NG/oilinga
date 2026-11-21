"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FilterPanel } from "@/components/marketplace/FilterPanel";
import { ProductGrid } from "@/components/marketplace/ProductCard";
import { QuerySelect } from "@/components/marketplace/QuerySelect";
import { RouteSearch } from "@/components/marketplace/RouteSearch";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { buildHref, parseNumber } from "@/lib/search-params";
import { LoadingState } from "@/components/ui/LoadingState";

const sortOptions = [
    { value: "recommended", label: "Recommended" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "rating", label: "Top rated" },
];

export function MarketplaceView() {
    return (
        <Suspense fallback={<LoadingState label="Loading marketplace" />}>
            <MarketplaceViewInner />
        </Suspense>
    );
}

function MarketplaceViewInner() {
    const params = useSearchParams();
    const { products, categories, loading, error } = useMarketplaceData();
    const q = params.get("q") ?? "";
    const category = params.get("category") ?? "all";
    const sort = params.get("sort") ?? "recommended";
    const min = parseNumber(params.get("min") ?? undefined);
    const max = parseNumber(params.get("max") ?? undefined);
    const verified = params.get("verified") === "1";
    const filtered = products.filter(product => {
        if (category !== "all" && product.category !== category) return false;
        if (min !== undefined && product.priceValue < min) return false;
        if (max !== undefined && product.priceValue > max) return false;
        if (verified && !product.sellerVerified) return false;
        const query = q.trim().toLowerCase();
        return !query || `${product.name} ${product.seller} ${product.detail} ${product.origin} ${product.description}`.toLowerCase().includes(query);
    });
    if (sort === "price-asc") filtered.sort((a, b) => a.priceValue - b.priceValue);
    if (sort === "price-desc") filtered.sort((a, b) => b.priceValue - a.priceValue);
    if (sort === "rating") filtered.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    const activeCategory = categories.find(item => item.id === category);
    const verifiedCount = products.filter(product => product.sellerVerified).length;
    const baseQuery = { q: q || undefined, category: category !== "all" ? category : undefined, sort: sort !== "recommended" ? sort : undefined, min, max, verified: verified ? "1" : undefined };
    const hasFilters = Boolean(q) || category !== "all" || min !== undefined || max !== undefined || verified;

    return <section className="oi-view oi-container" aria-labelledby="marketplace-title">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Marketplace" }]} />
        <div className="oi-page-heading"><div><span className="oi-eyebrow oi-eyebrow--green">Discover Oilinga</span><h1 id="marketplace-title" className="oi-page-heading__title">Marketplace</h1><p className="oi-page-heading__lede">Shop palm oil and groundnut oil from trusted sellers.</p></div><RouteSearch basePath="/marketplace" size="lg" placeholder="Search oils or shops…" className="oi-market-search" defaultValue={q} keep={{ category: category !== "all" ? category : undefined, sort: sort !== "recommended" ? sort : undefined, min, max, verified: verified ? "1" : undefined }} /></div>
        <div className="oi-market-layout">
            <FilterPanel>
                <fieldset className="oi-filters__group"><legend className="oi-filters__legend">Categories</legend>
                    <Link href={buildHref("/marketplace", { ...baseQuery, category: undefined })} className="oi-filters__link" aria-current={category === "all" ? "true" : undefined}>All products<span className="oi-filters__count">{products.length}</span></Link>
                    {categories.map(item => <Link key={item.id} href={buildHref("/marketplace", { ...baseQuery, category: item.id })} className="oi-filters__link" aria-current={category === item.id ? "true" : undefined}>{item.name}<span className="oi-filters__count">{products.filter(product => product.category === item.id).length}</span></Link>)}
                </fieldset>
                <hr className="oi-filters__divider" />
                <form className="oi-filter-form" action="/marketplace" method="get">
                    {q && <input type="hidden" name="q" value={q} />}{category !== "all" && <input type="hidden" name="category" value={category} />}{sort !== "recommended" && <input type="hidden" name="sort" value={sort} />}{verified && <input type="hidden" name="verified" value="1" />}
                    <fieldset className="oi-filters__group"><legend className="oi-filters__legend">Price range</legend><div className="oi-price-range"><input name="min" inputMode="numeric" placeholder="Min ₦" aria-label="Minimum price in naira" defaultValue={min ?? ""} /><input name="max" inputMode="numeric" placeholder="Max ₦" aria-label="Maximum price in naira" defaultValue={max ?? ""} /></div><button type="submit" className="oi-btn oi-btn--primary oi-btn--sm oi-btn--block">Apply price</button></fieldset>
                </form>
                <hr className="oi-filters__divider" />
                <fieldset className="oi-filters__group"><legend className="oi-filters__legend">Trust</legend><Link href={buildHref("/marketplace", { ...baseQuery, verified: verified ? undefined : "1" })} className="oi-filters__link" aria-current={verified ? "true" : undefined}>Verified sellers only<span className="oi-filters__count">{verifiedCount}</span></Link></fieldset>
                {hasFilters && <><hr className="oi-filters__divider" /><Link href="/marketplace" className="oi-filters__clear">Clear all filters</Link></>}
            </FilterPanel>
            <div>
                <div className="oi-result-bar"><QuerySelect label="Sort products" basePath="/marketplace" param="sort" value={sort} options={sortOptions} keep={{ q: q || undefined, category: category !== "all" ? category : undefined, min, max, verified: verified ? "1" : undefined }} /></div>
                {loading ? <LoadingState label="Loading products" variant="inline" /> : error ? <div className="oi-empty oi-empty--card" role="alert"><h3>Products could not be loaded</h3><p>{error}</p></div> : <><div className="oi-result-bar"><span>Showing <b>{filtered.length}</b> {filtered.length === 1 ? "product" : "products"}{activeCategory && <> in <b>{activeCategory.name}</b></>}{q && <> for <b>“{q}”</b></>}</span></div>{filtered.length ? <ProductGrid products={filtered} compact /> : <div className="oi-empty oi-empty--card"><span className="oi-empty__icon" aria-hidden="true"><Icon name="search" size={28} /></span><h3>{products.length ? "No products match those filters" : "No products are available yet"}</h3><p>{products.length ? "Try another search term, widen the price range, or clear the filters." : "Published seller products will appear here."}</p>{products.length > 0 && <Link className="oi-btn oi-btn--primary oi-btn--sm" href="/marketplace">Clear filters</Link>}</div>}</>}
            </div>
        </div>
    </section>;
}
