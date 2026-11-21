import type { Metadata } from "next";
import { EmailVerificationForm } from "@/components/auth/IdentityForms";
import { first, type QueryValue } from "@/lib/search-params";

export const metadata: Metadata = {
    title: "Verify email",
    robots: { index: false, follow: false },
};

interface VerifyEmailPageProps {
    searchParams: Promise<Record<string, QueryValue>>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
    const params = await searchParams;
    return <EmailVerificationForm token={first(params.token) ?? ""} />;
}
