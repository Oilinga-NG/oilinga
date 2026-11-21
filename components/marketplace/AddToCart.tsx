"use client";

import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/data";

export interface AddToCartProps {
    product: Product;
}

export function AddToCart({ product }: AddToCartProps) {
    const notify = useToast();
    const { addItem } = useCart();
    const { isInWishlist, toggleWishlist } = useWishlist();

    const wished = isInWishlist(product.slug);
    const inStock = Number(product.stock) > 0;

    async function handleAddToCart() {
        const added = await addItem(product);
        notify(added ? `${product.name} added to your cart` : `Could not add ${product.name} to your cart`);
    }

    async function handleToggleWishlist() {
        const wasWished = wished;
        const saved = await toggleWishlist(product);
        notify(saved ? (wasWished ? "Removed from wishlist" : "Added to wishlist") : "Wishlist could not be updated");
    }

    return (
        <div className="oi-pdp__actions">
            <button
                type="button"
                className="oi-btn oi-btn--gold oi-btn--lg"
                onClick={() => void handleAddToCart()}
                disabled={!inStock}
            >
                {inStock ? "Add to cart" : "Out of stock"}
                <Icon name="bag" size={17} />
            </button>
            <button
                type="button"
                className={cn("oi-btn oi-btn--outline oi-btn--lg", wished && "is-active")}
                onClick={() => void handleToggleWishlist()}
                aria-pressed={wished}
            >
                <Icon name="heart" size={17} />
                {wished ? "Saved ♡" : "Save for later"}
            </button>
        </div>
    );
}
