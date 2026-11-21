"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "./AuthProvider";

function IdentityShell({
    eyebrow,
    title,
    description,
    children,
    footer
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <section className="oi-auth oi-view">
            <div className="oi-container oi-auth__grid">
                <aside className="oi-auth__aside">
                    <Logo variant="light" size="lg" />
                    <span className="oi-eyebrow">Buy · Sell · Grow</span>
                    <h1>Your account stays yours.</h1>
                    <p>Keep your marketplace identity secure with verified email and recoverable passwords.</p>
                    <ul className="oi-auth__list">
                        <li><Icon name="shield" size={15} /> Encrypted, single-use recovery links</li>
                        <li><Icon name="check" size={15} /> Sessions you can review and revoke</li>
                        <li><Icon name="check" size={15} /> Role-based access for buyers and sellers</li>
                    </ul>
                </aside>
                <div className="oi-auth__panel">
                    <div className="oi-auth__head">
                        <span className="oi-eyebrow oi-eyebrow--green">{eyebrow}</span>
                        <h2>{title}</h2>
                        <p>{description}</p>
                    </div>
                    {children}
                    {footer && <p className="oi-auth__switch">{footer}</p>}
                </div>
            </div>
        </section>
    );
}

export function PasswordResetRequestForm() {
    const { requestPasswordReset } = useAuth();
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [devToken, setDevToken] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const result = await requestPasswordReset(email.trim());
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setDevToken(result.devToken ?? null);
        setSent(true);
    }

    return (
        <IdentityShell
            eyebrow="Account recovery"
            title="Reset your password"
            description="Enter the email on your Oilinga account and we will send you a secure reset link."
            footer={<>Remembered it? <Link href="/auth/login">Back to log in</Link></>}
        >
            {sent ? (
                <div className="oi-identity-result" role="status">
                    <Icon name="check" size={20} />
                    <p>If an account exists for that email, a reset link is on its way.</p>
                    {devToken && (
                        <p className="oi-identity-hint">
                            Development mode: <Link href={`/auth/reset-password?token=${encodeURIComponent(devToken)}`}>open your reset link</Link>.
                        </p>
                    )}
                </div>
            ) : (
                <form className="oi-auth__form" onSubmit={handleSubmit} noValidate>
                    {error && <p className="oi-auth__error" role="alert">{error}</p>}
                    <div className="oi-field">
                        <label className="oi-field__label" htmlFor="reset-email">Email address</label>
                        <input
                            id="reset-email"
                            className="oi-input"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={event => { setEmail(event.target.value); setError(""); }}
                            required
                        />
                    </div>
                    <Button type="submit" size="lg" block disabled={busy || !email.trim()}>
                        {busy ? "Sending…" : "Send reset link"}
                        <Icon name="arrow-right" size={16} />
                    </Button>
                </form>
            )}
        </IdentityShell>
    );
}

export function PasswordResetForm({ token }: { token: string }) {
    const { validateResetToken, resetPassword } = useAuth();
    const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!token) {
            setStatus("invalid");
            return () => { cancelled = true; };
        }
        void validateResetToken(token).then(valid => {
            if (!cancelled) setStatus(valid ? "valid" : "invalid");
        });
        return () => { cancelled = true; };
    }, [token, validateResetToken]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (password.length < 8) {
            setError("Use at least 8 characters.");
            return;
        }
        if (password !== confirm) {
            setError("The passwords don’t match yet.");
            return;
        }
        setBusy(true);
        setError("");
        const result = await resetPassword(token, password);
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setDone(true);
    }

    return (
        <IdentityShell
            eyebrow="Account recovery"
            title={done ? "Password updated" : "Choose a new password"}
            description={done ? "You can now log in with your new password." : "Pick a strong password you have not used on Oilinga before."}
            footer={<>Need a new link? <Link href="/auth/forgot-password">Request another reset</Link></>}
        >
            {status === "checking" && <p className="oi-loading-text">Checking your reset link…</p>}
            {status === "invalid" && !done && (
                <div className="oi-identity-result" role="alert">
                    <p>This reset link is invalid or has expired.</p>
                </div>
            )}
            {status === "valid" && !done && (
                <form className="oi-auth__form" onSubmit={handleSubmit} noValidate>
                    {error && <p className="oi-auth__error" role="alert">{error}</p>}
                    <div className="oi-field">
                        <label className="oi-field__label" htmlFor="new-password">New password</label>
                        <input
                            id="new-password"
                            className="oi-input"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={password}
                            onChange={event => { setPassword(event.target.value); setError(""); }}
                        />
                    </div>
                    <div className="oi-field">
                        <label className="oi-field__label" htmlFor="confirm-password">Confirm password</label>
                        <input
                            id="confirm-password"
                            className="oi-input"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={confirm}
                            onChange={event => { setConfirm(event.target.value); setError(""); }}
                        />
                    </div>
                    <Button type="submit" size="lg" block disabled={busy}>
                        {busy ? "Updating…" : "Update password"}
                        <Icon name="arrow-right" size={16} />
                    </Button>
                </form>
            )}
            {done && (
                <div className="oi-identity-result" role="status">
                    <Icon name="check" size={20} />
                    <Link href="/auth/login" className="oi-btn oi-btn--primary oi-btn--lg oi-btn--block">Log in</Link>
                </div>
            )}
        </IdentityShell>
    );
}

export function EmailVerificationForm({ token }: { token: string }) {
    const { verifyEmail } = useAuth();
    const [state, setState] = useState<"pending" | "verified" | "failed">("pending");
    const [error, setError] = useState("");
    const attempted = useRef(false);

    useEffect(() => {
        if (attempted.current) return;
        attempted.current = true;
        if (!token) {
            setState("failed");
            setError("No verification token was supplied.");
            return;
        }
        void verifyEmail(token).then(result => {
            if (result.ok) setState("verified");
            else {
                setState("failed");
                setError(result.error);
            }
        });
    }, [token, verifyEmail]);

    return (
        <IdentityShell
            eyebrow="Email verification"
            title={state === "verified" ? "Email verified" : state === "failed" ? "Verification failed" : "Verifying your email…"}
            description={state === "verified" ? "Your account email is confirmed. Thank you." : "One moment while we confirm your address."}
            footer={<>Back to your <Link href="/account">account</Link></>}
        >
            {state === "pending" && <p className="oi-loading-text">Checking your verification link…</p>}
            {state === "failed" && (
                <div className="oi-identity-result" role="alert">
                    <p>{error}</p>
                    <Link href="/account/settings" className="oi-btn oi-btn--outline oi-btn--sm">Request a new link</Link>
                </div>
            )}
            {state === "verified" && (
                <div className="oi-identity-result" role="status">
                    <Icon name="check" size={20} />
                    <Link href="/account" className="oi-btn oi-btn--primary oi-btn--lg oi-btn--block">Continue to your account</Link>
                </div>
            )}
        </IdentityShell>
    );
}
