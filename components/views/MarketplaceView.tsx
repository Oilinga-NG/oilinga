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
import { useMarketplaceData, useMarketplaceProductSearch } from "@/components/providers/MarketplaceDataProvider";
import { buildHref, parseNumber } from "@/lib/search-params";
import { LoadingState } from "@/components/ui/LoadingState";

const sortOptions = [
    { value: "recommended", label: "Recommended" },
    { value: "newest", label: "Newest first" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "name-asc", label: "Name: A to Z" },
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
    const { products: catalogue, categories, loading: catalogueLoading, error: catalogueError } = useMarketplaceData();
    const q = params.get("q") ?? "";
    const category = params.get("category") ?? "all";
    const sort = params.get("sort") ?? "recommended";
    const min = parseNumber(params.get("min") ?? undefined);
    const max = parseNumber(params.get("max") ?? undefined);
    const page = Math.max(1, Math.floor(parseNumber(params.get("page") ?? undefined) ?? 1));

    const { products, pagination, loading: productsLoading, error: productsError } = useMarketplaceProductSearch({
        search: q || undefined,
        category: category !== "all" ? category : undefined,
        minPrice: min,
        maxPrice: max,
        sort: sort as "recommended" | "price-asc" | "price-desc" | "newest" | "name-asc",
        page,
        limit: 12
    });

    const loading = catalogueLoading || productsLoading;
    const error = productsError ?? catalogueError;
    const activeCategory = categories.find(item => item.id === category);
    const baseQuery = { q: q || undefined, category: category !== "all" ? category : undefined, sort: sort !== "recommended" ? sort : undefined, min, max };
    const hasFilters = Boolean(q) || category !== "all" || min !== undefined || max !== undefined;

    return <section className="oi-view oi-container" aria-labelledby="marketplace-title">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Marketplace" }]} />
        <div className="oi-page-heading"><div><span className="oi-eyebrow oi-eyebrow--green">Discover Oilinga</span><h1 id="marketplace-title" className="oi-page-heading__title">Marketplace</h1><p className="oi-page-heading__lede">Shop palm oil and groundnut oil from trusted sellers.</p></div><RouteSearch basePath="/marketplace" size="lg" placeholder="Search oils or shops…" className="oi-market-search" defaultValue={q} keep={{ category: category !== "all" ? category : undefined, sort: sort !== "recommended" ? sort : undefined, min, max }} /></div>
        <div className="oi-market-layout">
            <FilterPanel>
                <fieldset className="oi-filters__group"><legend className="oi-filters__legend">Categories</legend>
                    <Link href={buildHref("/marketplace", { ...baseQuery, category: undefined })} className="oi-filters__link" aria-current={category === "all" ? "true" : undefined}>All products<span className="oi-filters__count">{catalogue.length}</span></Link>
                    {categories.map(item => <Link key={item.id} href={buildHref("/marketplace", { ...baseQuery, category: item.id })} className="oi-filters__link" aria-current={category === item.id ? "true" : undefined}>{item.name}<span className="oi-filters__count">{catalogue.filter(product => product.category === item.id).length}</span></Link>)}
                </fieldset>
                <hr className="oi-filters__divider" />
                <form className="oi-filter-form" action="/marketplace" method="get">
                    {q && <input type="hidden" name="q" value={q} />}{category !== "all" && <input type="hidden" name="category" value={category} />}{sort !== "recommended" && <input type="hidden" name="sort" value={sort} />}
                    <fieldset className="oi-filters__group"><legend className="oi-filters__legend">Price range</legend><div className="oi-price-range"><input name="min" inputMode="numeric" placeholder="Min ₦" aria-label="Minimum price in naira" defaultValue={min ?? ""} /><input name="max" inputMode="numeric" placeholder="Max ₦" aria-label="Maximum price in naira" defaultValue={max ?? ""} /></div><button type="submit" className="oi-btn oi-btn--primary oi-btn--sm oi-btn--block">Apply price</button></fieldset>
                </form>
                <hr className="oi-filters__divider" />
                <fieldset className="oi-filters__group"><legend className="oi-filters__legend">Trust</legend><p className="oi-filters__note">Only products from verified, published shops are shown.</p></fieldset>
                {hasFilters && <><hr className="oi-filters__divider" /><Link href="/marketplace" className="oi-filters__clear">Clear all filters</Link></>}
            </FilterPanel>
            <div>
                <div className="oi-result-bar"><QuerySelect label="Sort products" basePath="/marketplace" param="sort" value={sort} options={sortOptions} keep={{ q: q || undefined, category: category !== "all" ? category : undefined, min, max }} /></div>
                {loading ? <LoadingState label="Loading products" variant="inline" /> : error ? <div className="oi-empty oi-empty--card" role="alert"><h3>Products could not be loaded</h3><p>{error}</p></div> : <><div className="oi-result-bar"><span>Showing <b>{pagination.total}</b> {pagination.total === 1 ? "product" : "products"}{activeCategory && <> in <b>{activeCategory.name}</b></>}{q && <> for <b>“{q}”</b></>}</span></div>{products.length ? <ProductGrid products={products} compact /> : <div className="oi-empty oi-empty--card"><span className="oi-empty__icon" aria-hidden="true"><Icon name="search" size={28} /></span><h3>{hasFilters ? "No products match those filters" : "No products are available yet"}</h3><p>{hasFilters ? "Try another search term, widen the price range, or clear the filters." : "Approved seller products will appear here."}</p>{hasFilters && <Link className="oi-btn oi-btn--primary oi-btn--sm" href="/marketplace">Clear filters</Link>}</div>}{pagination.pages > 1 && <nav className="oi-pagination" aria-label="Product pages">
                    <Link className={`oi-pagination__link${page <= 1 ? " is-disabled" : ""}`} href={buildHref("/marketplace", { ...baseQuery, page: Math.max(1, page - 1) })} aria-disabled={page <= 1}><Icon name="arrow-left" size={14} /> Previous</Link>
                    {Array.from({ length: pagination.pages }, (_, index) => index + 1).map(item => <Link key={item} className={`oi-pagination__link${item === page ? " is-active" : ""}`} href={buildHref("/marketplace", { ...baseQuery, page: item })} aria-current={item === page ? "page" : undefined}>{item}</Link>)}
                    <Link className={`oi-pagination__link${page >= pagination.pages ? " is-disabled" : ""}`} href={buildHref("/marketplace", { ...baseQuery, page: Math.min(pagination.pages, page + 1) })} aria-disabled={page >= pagination.pages}>Next <Icon name="arrow-right" size={14} /></Link>
                </nav>}</>}
            </div>
        </div>
    </section>;
}
