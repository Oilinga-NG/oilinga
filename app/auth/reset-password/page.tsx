import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/auth/IdentityForms";
import { first, type QueryValue } from "@/lib/search-params";

export const metadata: Metadata = {
    title: "Choose a new password",
    robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
    searchParams: Promise<Record<string, QueryValue>>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
    const params = await searchParams;
    return <PasswordResetForm token={first(params.token) ?? ""} />;
}
