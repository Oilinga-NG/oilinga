import type { Metadata } from "next";
import { ProductDetailView } from "@/components/views/ProductDetailView";

interface ProductPageProps { params: Promise<{ slug: string }>; }

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { slug } = await params;
    return { title: `${slug.replace(/-/g, " ")} · Product`, description: "View a product published on the Oilinga marketplace." };
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    return <ProductDetailView slug={slug} />;
}
