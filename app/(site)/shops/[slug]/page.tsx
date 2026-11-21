import type { Metadata } from "next";
import { PublishedSellerShop } from "@/components/marketplace/PublishedSellerShop";

interface ShopPageProps { params: Promise<{ slug: string }>; }

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
    const { slug } = await params;
    return { title: `${slug.replace(/-/g, " ")} · Shop`, description: "Shop products published by this Oilinga seller." };
}

export default async function ShopPage({ params }: ShopPageProps) {
    const { slug } = await params;
    return <PublishedSellerShop mode="storefront" slug={slug} />;
}
