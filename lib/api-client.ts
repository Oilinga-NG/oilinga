"use client";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status; }
}

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");
const TOKEN_KEY = "oilinga_access_token";
let apiState = { pending: 0, error: null as string | null };
const serverApiState = { pending: 0, error: null as string | null };
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }

export function subscribeApiState(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function getApiState() { return apiState; }
export function getServerApiState() { return serverApiState; }
export function clearApiError() { apiState = { ...apiState, error: null }; notify(); }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    apiState = { ...apiState, pending: apiState.pending + 1 };
    notify();
    try {
        const headers = new Headers(init.headers);
        if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        if (typeof window !== "undefined") {
            const token = window.localStorage.getItem(TOKEN_KEY);
            if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        }
        const endpoint = `${apiBase}/${path.replace(/^\/+/, "")}`;
        const response = await fetch(endpoint, {
            ...init,
            credentials: "omit",
            headers,
        });
        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json") ? await response.json() : null;
        if (!response.ok) {
            const message = payload && typeof payload.message === "string" ? payload.message : payload && typeof payload.error === "string" ? payload.error : `Request failed (${response.status}).`;
            throw new ApiError(message, response.status);
        }
        apiState = { ...apiState, error: null };
        if (payload?.data !== undefined) return payload.data as T;
        return payload as T;
    } catch (error) {
        apiState = { ...apiState, error: error instanceof Error ? error.message : "Could not reach the Oilinga API." };
        throw error;
    } finally {
        apiState = { ...apiState, pending: Math.max(0, apiState.pending - 1) };
        notify();
    }
}
