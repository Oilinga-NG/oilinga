import type { Metadata } from "next";
import { SubscribeView } from "@/components/views/SubscribeView";
import { first, type QueryValue } from "@/lib/search-params";

export const metadata: Metadata = {
    title: "Subscribe — Oilinga",
    robots: { index: false, follow: false },
};

interface SubscribePageProps {
    searchParams: Promise<Record<string, QueryValue>>;
}

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
    const params = await searchParams;
    const plan = first(params.plan) ?? "";
    return <SubscribeView planId={plan} />;
}
