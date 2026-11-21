import type { Metadata } from "next";
import { SubscriptionPricing } from "@/components/views/SubscriptionPricing";

export const metadata: Metadata = {
    title: "Seller Plans & Pricing — Oilinga",
    description: "Choose a plan to sell on Oilinga. Start free and grow your business across Africa.",
};

export default function PricingPage() {
    return <SubscriptionPricing />;
}
