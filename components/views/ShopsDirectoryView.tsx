"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublishedSellerShop } from "@/components/marketplace/PublishedSellerShop";
import { RouteSearch } from "@/components/marketplace/RouteSearch";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState } from "@/components/ui/LoadingState";
import type { ProductCategory } from "@/lib/data";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { buildHref } from "@/lib/search-params";

export function ShopsDirectoryView() {
    return (
        <Suspense fallback={<LoadingState label="Loading shops" />}>
            <ShopsDirectoryViewInner />
        </Suspense>
    );
}

function ShopsDirectoryViewInner() {
    const params = useSearchParams();
    const { shops, categories, loading } = useMarketplaceData();
    const q = params.get("q") ?? "";
    const category = params.get("category") ?? "all";
    const filtered = shops.filter(shop => {
        if (category !== "all" && !shop.categories.includes(category as ProductCategory)) return false;
        return !q || `${shop.name} ${shop.location} ${shop.tagline} ${shop.description}`.toLowerCase().includes(q.toLowerCase());
    });

    return <section className="oi-view oi-container" aria-labelledby="shops-title">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shops" }]} />
        <div className="oi-page-heading"><div><span className="oi-eyebrow oi-eyebrow--green">The people behind the oil</span><h1 id="shops-title" className="oi-page-heading__title">Shop directory</h1><p className="oi-page-heading__lede">Browse producers with shops and products published on Oilinga.</p></div><RouteSearch basePath="/shops" size="lg" placeholder="Search shops or locations…" label="Search shops" defaultValue={q} keep={{ category: category !== "all" ? category : undefined }} className="oi-market-search" /></div>
        <div className="oi-chip-row" aria-label="Filter shops by category"><Link href={buildHref("/shops", { q: q || undefined, category: undefined })} className="oi-chip" aria-current={category === "all" ? "true" : undefined}>All shops</Link>{categories.map(item => <Link key={item.id} href={buildHref("/shops", { q: q || undefined, category: item.id })} className="oi-chip" aria-current={category === item.id ? "true" : undefined}>{item.name}</Link>)}</div>
        <div className="oi-result-bar"><span>{!loading && <>Showing <b>{filtered.length}</b> {filtered.length === 1 ? "shop" : "shops"}{shops.length !== filtered.length && <> of {shops.length}</>}</>}</span>{loading ? <LoadingState label="Loading shops" variant="inline" /> : (q || category !== "all") && <Link href="/shops" className="oi-result-bar__reset">Reset</Link>}</div>
        <PublishedSellerShop mode="directory" query={q} category={category} />
    </section>;
}
