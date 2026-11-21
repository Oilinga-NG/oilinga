import type { Metadata } from "next";
import { SubscriptionManagement } from "@/components/views/SubscriptionManagement";

export const metadata: Metadata = {
    title: "My Subscription — Oilinga",
};

export default function SubscriptionPage() {
    return <SubscriptionManagement />;
}
