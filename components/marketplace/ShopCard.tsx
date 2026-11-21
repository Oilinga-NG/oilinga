"use client";

import Link from "next/link";
import type { Shop } from "@/lib/data";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { LiveRating } from "@/components/ui/LiveRating";

export function ShopCard({ shop }: { shop: Shop }) {
    const count = shop.productsCount;

    return (
        <article className="oi-shop-card">
            <Link
                href={`/shops/${shop.slug}`}
                className="oi-shop-card__head"
                aria-label={`Visit ${shop.name}`}
            >
                <span
                    className={cn("oi-shop-card__mark", `oi-shop-card__mark--${shop.accent}`)}
                    aria-hidden="true"
                >
                    {shop.initials}
                </span>
                <span className="oi-shop-card__title">
                    <strong>{shop.name}</strong>
                    {shop.verified && (
                        <Badge tone="green">
                            <Icon name="check" size={10} />
                            Verified
                        </Badge>
                    )}
                </span>
            </Link>

            <p className="oi-shop-card__tagline">{shop.tagline}</p>

            <div className="oi-shop-card__meta">
                <Icon name="pin" size={13} />
                <span>{shop.location}</span>
                {shop.since && <><span className="oi-shop-card__dot" aria-hidden="true" /><span>Since {shop.since}</span></>}
            </div>

            <div className="oi-shop-card__footer">
                <LiveRating targetType="shop" targetId={shop.slug} fallback={{ rating: shop.rating, reviews: shop.reviews }} />
                <span className="oi-shop-card__count">
                    {count} {count === 1 ? "product" : "products"}
                </span>
            </div>
        </article>
    );
}

export function ShopGrid({ shops }: { shops: Shop[] }) {
    return (
        <div className="oi-shop-grid">
            {shops.map((shop) => (
                <ShopCard key={shop.slug} shop={shop} />
            ))}
        </div>
    );
}
