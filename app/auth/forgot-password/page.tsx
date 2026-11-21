import type { Metadata } from "next";
import { PasswordResetRequestForm } from "@/components/auth/IdentityForms";

export const metadata: Metadata = {
    title: "Reset password",
    robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
    return <PasswordResetRequestForm />;
}
