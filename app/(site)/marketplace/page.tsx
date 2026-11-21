import type { Metadata } from "next";
import { MarketplaceView } from "@/components/views/MarketplaceView";

export const metadata: Metadata = {
    title: "Marketplace",
    description: "Browse products currently published by Oilinga sellers.",
};

export default function MarketplacePage() { return <MarketplaceView />; }
