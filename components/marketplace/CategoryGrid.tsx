"use client";

import Link from "next/link";
import type { Category } from "@/lib/data";
import { LoadingState } from "@/components/ui/LoadingState";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";

export interface CategoryGridProps {
    categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
    const { products, loading } = useMarketplaceData();
    const counts = products.reduce<Record<string, number>>((result, product) => {
        result[product.category] = (result[product.category] ?? 0) + 1;
        return result;
    }, {});

    return (
        <div className="oi-category-grid">
            {categories.map((category) => (
                <Link
                    key={category.id}
                    href={`/marketplace?category=${category.id}`}
                    className="oi-category-card"
                >
                    <span className="oi-category-card__icon" aria-hidden="true">
                        {category.glyph}
                    </span>
                    <strong className="oi-category-card__name">{category.name}</strong>
                    <small className="oi-category-card__caption">
                        {loading ? <LoadingState label="Loading" variant="inline" /> : `${counts[category.id] ?? 0} ${(counts[category.id] ?? 0) === 1 ? "product" : "products"}`}
                    </small>
                </Link>
            ))}
        </div>
    );
}
