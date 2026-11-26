"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, clearAccessToken, isSessionExpired, setAccessToken, subscribeSessionExpiry } from "@/lib/api-client";

export type UserRole = "customer" | "seller" | "admin";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type SignupRole = "CUSTOMER" | "SELLER";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    initials: string;
    joined: string;
    role: UserRole;
    status: AccountStatus;
    emailVerifiedAt: string | null;
    phone: string | null;
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };
export type IdentityResult = { ok: true; devToken?: string } | { ok: false; error: string };

export interface SessionInfo {
    id: string;
    createdAt: string;
    expiresAt: string;
    lastUsedAt: string;
    revokedAt: string | null;
    current: boolean;
}

interface AuthContextValue {
    user: AuthUser | null;
    ready: boolean;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<AuthResult>;
    signUp: (name: string, email: string, password: string, role?: SignupRole) => Promise<AuthResult>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<IdentityResult>;
    validateResetToken: (token: string) => Promise<boolean>;
    resetPassword: (token: string, password: string) => Promise<IdentityResult>;
    requestVerification: () => Promise<IdentityResult>;
    verifyEmail: (token: string) => Promise<IdentityResult>;
    listSessions: () => Promise<SessionInfo[]>;
    revokeSession: (id: string) => Promise<IdentityResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type ApiUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    status: AccountStatus;
    emailVerifiedAt: string | null;
    phone: string | null;
    joined?: string;
    createdAt?: string;
};

function asAuthUser(user: ApiUser): AuthUser {
    const name = user.name || "Oilinga customer";
    return {
        id: user.id,
        name,
        email: user.email,
        role: String(user.role).toLowerCase() as UserRole,
        status: user.status ?? "ACTIVE",
        emailVerifiedAt: user.emailVerifiedAt ?? null,
        phone: user.phone ?? null,
        joined: user.joined ?? user.createdAt?.slice(0, 10) ?? "",
        initials: name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()
    };
}

function messageFor(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function isUnauthorized(error: unknown): boolean {
    return error instanceof Error && "status" in error && error.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshUser = useCallback(async () => {
        try {
            const result = await apiFetch<ApiUser>("/auth/me");
            setUser(asAuthUser(result));
            setError(null);
        } catch (requestError) {
            setUser(null);
            if (isSessionExpired(requestError)) {
                setError(null);
                return;
            }
            if (isUnauthorized(requestError)) {
                clearAccessToken();
            } else {
                setError(messageFor(requestError, "Could not load your account."));
            }
        } finally { setReady(true); }
    }, []);

    useEffect(() => { void refreshUser(); }, [refreshUser]);

    useEffect(() => subscribeSessionExpiry(() => {
        setUser(null);
        setError(null);
    }), []);

    const authenticate = useCallback(async (
        action: "signup" | "signin",
        fields: { name?: string; email: string; password: string; role?: SignupRole }
    ): Promise<AuthResult> => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiFetch<{ user: ApiUser; accessToken: string }>(
                action === "signup" ? "/auth/register" : "/auth/login",
                { method: "POST", body: JSON.stringify(fields) }
            );
            setAccessToken(result.accessToken);
            const authenticatedUser = asAuthUser(result.user);
            setUser(authenticatedUser);
            return { ok: true, user: authenticatedUser };
        } catch (requestError) {
            const message = messageFor(requestError, "Authentication failed. Try again.");
            setError(message);
            return { ok: false, error: message };
        } finally { setLoading(false); setReady(true); }
    }, []);

    const signIn = useCallback((email: string, password: string) => authenticate("signin", { email, password }), [authenticate]);
    const signUp = useCallback(
        (name: string, email: string, password: string, role: SignupRole = "CUSTOMER") =>
            authenticate("signup", { name, email, password, role }),
        [authenticate]
    );

    const signOut = useCallback(async () => {
        setLoading(true);
        try {
            // Revoke the server-side session before discarding the local token.
            await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
            setUser(null);
        } finally {
            clearAccessToken();
            setLoading(false);
        }
    }, []);

    const requestPasswordReset = useCallback(async (email: string): Promise<IdentityResult> => {
        try {
            const result = await apiFetch<{ devToken?: string }>("/auth/password/forgot", {
                method: "POST", body: JSON.stringify({ email })
            });
            return { ok: true, ...(result.devToken ? { devToken: result.devToken } : {}) };
        } catch (requestError) {
            return { ok: false, error: messageFor(requestError, "Could not request a reset link.") };
        }
    }, []);

    const validateResetToken = useCallback(async (token: string): Promise<boolean> => {
        try {
            const result = await apiFetch<{ valid: boolean }>(`/auth/password/validate?token=${encodeURIComponent(token)}`);
            return result.valid;
        } catch { return false; }
    }, []);

    const resetPassword = useCallback(async (token: string, password: string): Promise<IdentityResult> => {
        try {
            await apiFetch("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
            return { ok: true };
        } catch (requestError) {
            return { ok: false, error: messageFor(requestError, "Could not reset your password.") };
        }
    }, []);

    const requestVerification = useCallback(async (): Promise<IdentityResult> => {
        try {
            const result = await apiFetch<{ devToken?: string; alreadyVerified?: boolean }>("/auth/email/verification/request", { method: "POST" });
            if (result.alreadyVerified) {
                await refreshUser();
                return { ok: true };
            }
            return { ok: true, ...(result.devToken ? { devToken: result.devToken } : {}) };
        } catch (requestError) {
            return { ok: false, error: messageFor(requestError, "Could not send a verification link.") };
        }
    }, [refreshUser]);

    const verifyEmail = useCallback(async (token: string): Promise<IdentityResult> => {
        try {
            await apiFetch("/auth/email/verification/confirm", { method: "POST", body: JSON.stringify({ token }) });
            await refreshUser();
            return { ok: true };
        } catch (requestError) {
            return { ok: false, error: messageFor(requestError, "Could not verify your email.") };
        }
    }, [refreshUser]);

    const listSessions = useCallback(async (): Promise<SessionInfo[]> => {
        return apiFetch<SessionInfo[]>("/auth/sessions");
    }, []);

    const revokeSession = useCallback(async (id: string): Promise<IdentityResult> => {
        try {
            await apiFetch(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
            return { ok: true };
        } catch (requestError) {
            return { ok: false, error: messageFor(requestError, "Could not revoke this session.") };
        }
    }, []);

    const value = useMemo(() => ({
        user, ready, loading, error,
        signIn, signUp, signOut, refreshUser,
        requestPasswordReset, validateResetToken, resetPassword,
        requestVerification, verifyEmail, listSessions, revokeSession
    }), [
        user, ready, loading, error,
        signIn, signUp, signOut, refreshUser,
        requestPasswordReset, validateResetToken, resetPassword,
        requestVerification, verifyEmail, listSessions, revokeSession
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider.");
    return context;
}
