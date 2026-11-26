"use client";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status; }
}

/** Raised after a failed refresh so callers never surface a token error. Its message is intentionally empty. */
export class SessionExpiredError extends ApiError {
    constructor() { super("", 401); this.name = "SessionExpiredError"; }
}

export function isSessionExpired(error: unknown): error is SessionExpiredError {
    return error instanceof SessionExpiredError;
}

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");
const TOKEN_KEY = "oilinga_access_token";
const REFRESH_PATH = "auth/refresh";
const REFRESH_SKIP_PATHS = new Set([
    "auth/login",
    "auth/register",
    "auth/refresh",
    "auth/password/forgot",
    "auth/password/validate",
    "auth/password/reset",
    "auth/email/verification/confirm",
]);
let apiState = { pending: 0, error: null as string | null };
const serverApiState = { pending: 0, error: null as string | null };
const listeners = new Set<() => void>();
const sessionExpiryListeners = new Set<() => void>();
let refreshInFlight: Promise<boolean> | null = null;

function notify() { listeners.forEach(listener => listener()); }

export function subscribeApiState(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function getApiState() { return apiState; }
export function getServerApiState() { return serverApiState; }
export function clearApiError() { apiState = { ...apiState, error: null }; notify(); }

export function subscribeSessionExpiry(listener: () => void) {
    sessionExpiryListeners.add(listener);
    return () => { sessionExpiryListeners.delete(listener); };
}

export function getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setAccessToken(token: string) {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* Storage can be disabled by the browser. */ }
}

export function clearAccessToken() {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* Storage can be disabled by the browser. */ }
}

function normalizedPath(path: string) {
    return path.replace(/^\/+/, "").split(/[?#]/)[0];
}

function canRefresh(path: string, hadToken: boolean) {
    return hadToken && !REFRESH_SKIP_PATHS.has(normalizedPath(path));
}

function nextDestination() {
    if (typeof window === "undefined") return "/account";
    const { pathname, search, hash } = window.location;
    const current = `${pathname}${search}${hash}`;
    return current.startsWith("/") && !current.startsWith("//") ? current : "/account";
}

function handleSessionExpired(): never {
    clearAccessToken();
    const next = nextDestination();
    sessionExpiryListeners.forEach(listener => {
        try { listener(); } catch { /* A failing subscriber must not block navigation. */ }
    });
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/login")) {
        window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
    }
    throw new SessionExpiredError();
}

function refreshAccessToken(): Promise<boolean> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
        try {
            const response = await fetch(`${apiBase}/${REFRESH_PATH}`, {
                method: "POST",
                credentials: "include",
                headers: { Accept: "application/json" },
            });
            if (!response.ok) return false;
            const payload = await response.json().catch(() => null) as { data?: { accessToken?: unknown } } | null;
            const token = payload?.data?.accessToken;
            if (typeof token !== "string" || !token) return false;
            setAccessToken(token);
            return true;
        } catch {
            return false;
        }
    })().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
}

async function readPayload(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    return response.json().catch(() => null) as Record<string, any> | null;
}

async function requestOnce<T>(path: string, init: RequestInit, token: string | null, replaceAuthorization: boolean): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (token && (replaceAuthorization || !headers.has("Authorization"))) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${apiBase}/${path.replace(/^\/+/, "")}`, {
        ...init,
        credentials: "include",
        headers,
    });
    const payload = await readPayload(response);
    if (!response.ok) {
        const message = payload && typeof payload.message === "string"
            ? payload.message
            : payload && typeof payload.error === "string"
                ? payload.error
                : `Request failed (${response.status}).`;
        throw new ApiError(message, response.status);
    }
    return (payload?.data !== undefined ? payload.data : payload) as T;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    apiState = { ...apiState, pending: apiState.pending + 1 };
    notify();
    const token = getAccessToken();
    try {
        try {
            return await requestOnce<T>(path, init, token, false);
        } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 401 || !canRefresh(path, Boolean(token))) throw error;
            const refreshed = await refreshAccessToken();
            if (!refreshed) return handleSessionExpired();
            try {
                return await requestOnce<T>(path, init, getAccessToken(), true);
            } catch (retryError) {
                if (retryError instanceof ApiError && retryError.status === 401) return handleSessionExpired();
                throw retryError;
            }
        }
    } catch (error) {
        const silentUnauthorized = error instanceof ApiError && error.status === 401 && normalizedPath(path) === "auth/me";
        if (!isSessionExpired(error) && !silentUnauthorized) {
            apiState = { ...apiState, error: error instanceof Error ? error.message : "Could not reach the Oilinga API." };
        }
        throw error;
    } finally {
        apiState = { ...apiState, pending: Math.max(0, apiState.pending - 1) };
        notify();
    }
}
