import type { IconName } from "@/components/ui/Icon";

export type ProductArt = "palm" | "refined" | "kernel" | "groundnut";
export type ProductCategory = string;
export type ProductStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
export type ShopStatus = "ACTIVE" | "DRAFT" | "SUSPENDED";

export interface ProductMedia {
    url: string;
    alt?: string | null;
    id?: string;
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

export interface TrustSignal { title: string; caption: string; icon: IconName; }
export interface SellerNavItem { label: string; icon: IconName; }
export interface Metric { label: string; value: string; trend: string; up?: boolean; }
export interface Order { id: string; customer: string; date: string; amount: string; status: string; }

// Initial taxonomy. Admin-created categories are stored in the shared database.
export const defaultCategories: Category[] = [
    { id: "crude-palm", name: "Palm Oil", caption: "Locally produced palm oil", glyph: "🫙" },
    { id: "groundnut", name: "Groundnut Oil", caption: "Locally pressed groundnut oil", glyph: "🥜" },
];

export const trustSignals: TrustSignal[] = [
    { icon: "shield", title: "Secure transactions", caption: "Protected checkout" },
    { icon: "truck", title: "Fast & reliable delivery", caption: "From trusted sellers" },
    { icon: "leaf", title: "Trusted community", caption: "Verified businesses" },
    { icon: "headset", title: "Dedicated support", caption: "Here when you need us" },
];

export const categories = defaultCategories;
export const popularSearches = defaultCategories.map(category => category.name);
export function getCategory(id: string) { return defaultCategories.find(category => category.id === id); }
export function getCategoryName(id: string) { return getCategory(id)?.name ?? "Oils"; }
export function getCategoryArt(category: ProductCategory): ProductArt {
    if (category === "groundnut") return "groundnut";
    return "palm";
}
export function getCategoryGlyph(category: ProductCategory) {
    return defaultCategories.find(item => item.id === category)?.glyph ?? "🫙";
}
export function formatNaira(value: number) { return `₦${value.toLocaleString("en-NG")}`; }

export const sellerNav: SellerNavItem[] = [
    { label: "Overview", icon: "grid" }, { label: "My shop", icon: "store" }, { label: "Products", icon: "box" },
    { label: "Orders", icon: "receipt" }, { label: "Inventory", icon: "archive" }, { label: "Earnings", icon: "wallet" },
    { label: "Subscription", icon: "sparkle" }, { label: "Settings", icon: "settings" },
];
