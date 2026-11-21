"use client";

import Link from "next/link";
import type { Product } from "@/lib/data";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { LiveRating } from "@/components/ui/LiveRating";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";

export interface ProductCardProps {
    product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
    const notify = useToast();
    const { addItem } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();

    const wished = isInWishlist(product.slug);
    const inStock = Number(product.stock) > 0;
    const productHref = `/products/${product.slug}`;

    async function handleAddToCart() {
        const added = await addItem(product);
        notify(added ? `${product.name} added to your cart` : `Could not add ${product.name} to your cart`);
    }

    async function handleWishlist() {
        const wasWished = wished;
        const saved = await toggleWishlist(product);
        notify(saved ? (wasWished ? "Removed from wishlist" : "Added to wishlist") : "Wishlist could not be updated");
    }

    return (
        <article className="oi-product-card">
            <Link
                href={productHref}
                className={cn(
                    "oi-product-card__art",
                    `oi-product-card__art--${product.art}`,
                )}
                aria-label={`View ${product.name}`}
                tabIndex={-1}
            >
                <Badge tone="neutral" className="oi-product-card__tag">
                    {product.tag}
                </Badge>
                {product.imageUrl && <img className="oi-product-card__image" src={product.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
                <span className="oi-product-card__glyph" aria-hidden="true">
                    {product.glyph}
                </span>
                <button
                    type="button"
                    className={cn("oi-product-card__wish", wished && "is-active")}
                    aria-label={
                        wished
                            ? `Remove ${product.name} from wishlist`
                            : `Add ${product.name} to wishlist`
                    }
                    onClick={(e) => {
                        e.preventDefault();
                        void handleWishlist();
                    }}
                >
                    <Icon name="heart" size={14} />
                </button>
            </Link>
            <div className="oi-product-card__body">
                <Link
                    href={`/shops/${product.shopSlug}`}
                    className="oi-product-card__seller"
                >
                    <Icon name={product.sellerVerified === false ? "store" : "check"} size={12} />
                    {product.seller}
                </Link>
                <h3 className="oi-product-card__name">
                    <Link href={productHref}>{product.name}</Link>
                </h3>
                <p className="oi-product-card__meta">{product.detail}</p>
                <LiveRating
                    targetType="product"
                    targetId={product.slug}
                    fallback={{ rating: product.rating, reviews: product.reviews }}
                    className="oi-product-card__rating"
                />
                <div className="oi-product-card__footer">
                    <strong className="oi-product-card__price">{product.price}</strong>
                    <button
                        type="button"
                        className="oi-add-btn"
                        onClick={() => void handleAddToCart()}
                        disabled={!inStock}
                        title={inStock ? undefined : "Out of stock"}
                        aria-label={inStock ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
                    >
                        <Icon name="plus" size={18} />
                    </button>
                </div>
            </div>
        </article>
    );
}

export interface ProductGridProps {
    products: Product[];
    compact?: boolean;
}

export function ProductGrid({ products, compact = false }: ProductGridProps) {
    return (
        <div className={cn("oi-product-grid", compact && "oi-product-grid--compact")}>
            {products.map((product) => (
                <ProductCard key={product.slug} product={product} />
            ))}
        </div>
    );
}
