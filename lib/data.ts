import type { IconName } from "@/components/ui/Icon";

export type ProductArt = "palm" | "refined" | "kernel" | "groundnut";
export type ProductCategory = string;
export type ProductStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
export type ShopStatus = "ACTIVE" | "DRAFT" | "SUSPENDED";

export interface ProductMedia {
    url: string;
    alt?: string | null;
    id?: string;
    isPrimary?: boolean;
}

export interface Shop {
    id?: string;
    slug: string;
    name: string;
    initials: string;
    tagline: string;
    description: string;
    location: string;
    since?: number;
    rating: number;
    reviews: number;
    verified: boolean;
    published?: boolean;
    status?: ShopStatus;
    verificationRequestedAt?: string | null;
    categories: ProductCategory[];
    specialties: string[];
    accent: ProductArt;
    productsCount: number;
}

export interface Product {
    id?: string;
    slug: string;
    sellerManaged?: boolean;
    sellerVerified?: boolean;
    shopSlug: string;
    seller: string;
    name: string;
    detail: string;
    price: string;
    priceValue: number;
    category: ProductCategory;
    art: ProductArt;
    glyph: string;
    tag: string;
    rating: number;
    reviews: number;
    stock: number;
    size: string;
    origin: string;
    description: string;
    status?: ProductStatus;
    imageUrl?: string | null;
    media?: ProductMedia[];
}

export interface Category {
    id: ProductCategory;
    name: string;
    caption: string;
    glyph: string;
}

export interface SellerNavItem { label: string; icon: IconName; }
export interface Metric { label: string; value: string; trend: string; up?: boolean; }
export interface Order { id: string; customer: string; date: string; amount: string; status: string; }

/** Visual treatment only; category names, ids and glyphs come from the database. */
export function getCategoryArt(category: ProductCategory): ProductArt {
    const value = String(category ?? "").toLowerCase();
    return value.includes("groundnut") || value.includes("peanut") ? "groundnut" : "palm";
}
export function formatNaira(value: number) { return `₦${value.toLocaleString("en-NG")}`; }

export const sellerNav: SellerNavItem[] = [
    { label: "Overview", icon: "grid" }, { label: "My shop", icon: "store" }, { label: "Products", icon: "box" },
    { label: "Orders", icon: "receipt" }, { label: "Inventory", icon: "archive" }, { label: "Earnings", icon: "wallet" },
    { label: "Subscription", icon: "sparkle" }, { label: "Settings", icon: "settings" },
];
