"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth, type SessionInfo } from "./AuthProvider";
import { AccountSidebarNav } from "./AccountSidebarNav";
import { apiFetch } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

export function AccountSettings() {
    const router = useRouter();
    const { user, ready, refreshUser, requestVerification, listSessions, revokeSession } = useAuth();
    const notify = useToast();

    const [name, setName] = useState("");
    const [profileError, setProfileError] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const [verifying, setVerifying] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState("");
    const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [sessionsError, setSessionsError] = useState("");

    const initialized = useRef(false);

    useEffect(() => {
        if (ready && !user) {
            router.replace("/login?next=/account/settings");
        }
    }, [ready, user, router]);

    useEffect(() => {
        if (user && !initialized.current) {
            setName(user.name);
            initialized.current = true;
        }
    }, [user]);

    useEffect(() => {
        if (!ready || !user) return;
        let cancelled = false;
        setSessionsLoading(true);
        void listSessions()
            .then(rows => { if (!cancelled) setSessions(rows); })
            .catch(error => { if (!cancelled) setSessionsError(error instanceof Error ? error.message : "Could not load sessions."); })
            .finally(() => { if (!cancelled) setSessionsLoading(false); });
        return () => { cancelled = true; };
    }, [ready, user, listSessions]);

    if (!ready) {
        return <LoadingState label="Loading account settings" />;
    }

    if (!user) {
        return <LoadingState label="Redirecting to sign in" />;
    }

    async function handleProfileSave(e: React.FormEvent) {
        e.preventDefault();
        setProfileError("");

        if (!name.trim()) {
            setProfileError("Name cannot be empty.");
            return;
        }

        try {
            await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
            await refreshUser();
            notify("Profile saved");
        } catch (error) { setProfileError(error instanceof Error ? error.message : "Could not save profile."); }
    }

    async function handlePasswordChange(e: React.FormEvent) {
        e.preventDefault();
        setPasswordError("");

        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords do not match.");
            return;
        }

        try {
            await apiFetch("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); notify("Password updated");
        } catch (error) { setPasswordError(error instanceof Error ? error.message : "Could not update password."); }
    }

    async function handleResendVerification() {
        setVerifying(true);
        setVerificationMessage("");
        const result = await requestVerification();
        setVerifying(false);
        if (!result.ok) {
            setVerificationMessage(result.error);
            return;
        }
        setDevVerificationToken(result.devToken ?? null);
        setVerificationMessage(result.devToken ? "Verification link ready in development mode." : "Verification email sent.");
        await refreshUser();
        notify("Verification email sent");
    }

    async function handleRevokeSession(id: string) {
        const result = await revokeSession(id);
        if (!result.ok) {
            setSessionsError(result.error);
            return;
        }
        setSessions(current => current.map(session => session.id === id ? { ...session, revokedAt: new Date().toISOString() } : session));
        notify("Session revoked");
    }

    return (
        <section className="oi-view oi-container" aria-labelledby="settings-title">
            <div className="oi-dashboard">
                <AccountSidebarNav />

                <div className="oi-dashboard__content">
                    <h1 id="settings-title" className="oi-page-title">
                        Account settings
                    </h1>

                    {/* Verification section */}
                    <section className="oi-form-section" aria-label="Email verification">
                        <h2 className="oi-section-title">Email verification</h2>
                        <p className="oi-identity-result">
                            {user.emailVerifiedAt
                                ? `Verified on ${new Date(user.emailVerifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
                                : "Verify your email to complete your Oilinga profile."}
                        </p>
                        {!user.emailVerifiedAt && (
                            <Button type="button" variant="outline" size="sm" onClick={handleResendVerification} disabled={verifying}>
                                {verifying ? "Sending…" : "Send verification email"}
                            </Button>
                        )}
                        {verificationMessage && <p className="oi-muted" role="status">{verificationMessage}</p>}
                        {devVerificationToken && (
                            <p className="oi-identity-hint">
                                Development mode:{" "}
                                <Link href={`/auth/verify-email?token=${encodeURIComponent(devVerificationToken)}`}>open your verification link</Link>.
                            </p>
                        )}
                    </section>

                    {/* Profile section */}
                    <form
                        className="oi-form-section"
                        onSubmit={handleProfileSave}
                        aria-label="Profile settings"
                    >
                        <h2 className="oi-section-title">Profile</h2>

                        <div className="oi-form-group">
                            <label htmlFor="settings-name" className="oi-form-label">
                                Full name
                            </label>
                            <input
                                id="settings-name"
                                type="text"
                                className="oi-form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                            />
                        </div>

                        <div className="oi-form-group">
                            <label htmlFor="settings-email" className="oi-form-label">
                                Email address
                            </label>
                            <input
                                id="settings-email"
                                type="email"
                                className="oi-form-input"
                                value={user.email}
                                readOnly
                                aria-readonly="true"
                            />
                        </div>

                        {profileError && (
                            <p className="oi-form-error" role="alert">
                                {profileError}
                            </p>
                        )}

                        <Button type="submit" variant="primary" size="sm">
                            Save profile
                        </Button>
                    </form>

                    {/* Password section */}
                    <form
                        className="oi-form-section"
                        onSubmit={handlePasswordChange}
                        aria-label="Change password"
                    >
                        <h2 className="oi-section-title">Change password</h2>

                        <div className="oi-form-group">
                            <label htmlFor="settings-current-pw" className="oi-form-label">
                                Current password
                            </label>
                            <input
                                id="settings-current-pw"
                                type="password"
                                className="oi-form-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="oi-form-group">
                            <label htmlFor="settings-new-pw" className="oi-form-label">
                                New password
                            </label>
                            <input
                                id="settings-new-pw"
                                type="password"
                                className="oi-form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                            />
                        </div>

                        <div className="oi-form-group">
                            <label htmlFor="settings-confirm-pw" className="oi-form-label">
                                Confirm new password
                            </label>
                            <input
                                id="settings-confirm-pw"
                                type="password"
                                className="oi-form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>

                        {passwordError && (
                            <p className="oi-form-error" role="alert">
                                {passwordError}
                            </p>
                        )}

                        <Button type="submit" variant="outline" size="sm">
                            Update password
                        </Button>
                    </form>

                    {/* Sessions section */}
                    <section className="oi-form-section" aria-label="Active sessions">
                        <h2 className="oi-section-title">Active sessions</h2>
                        {sessionsError && <p className="oi-form-error" role="alert">{sessionsError}</p>}
                        {sessionsLoading ? (
                            <p className="oi-muted">Loading sessions…</p>
                        ) : sessions.length === 0 ? (
                            <p className="oi-muted">No sessions available.</p>
                        ) : (
                            <div className="oi-session-list">
                                {sessions.map(session => (
                                    <div className="oi-session-row" key={session.id}>
                                        <div>
                                            <b>{session.current ? "This device" : "Another device"}</b>
                                            <small>
                                                Started {new Date(session.createdAt).toLocaleString()} ·{" "}
                                                {session.revokedAt ? "Revoked" : `Expires ${new Date(session.expiresAt).toLocaleDateString()}`}
                                            </small>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={session.current || Boolean(session.revokedAt)}
                                            onClick={() => handleRevokeSession(session.id)}
                                        >
                                            {session.current ? "Current" : session.revokedAt ? "Revoked" : "Revoke"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </section>
    );
}
