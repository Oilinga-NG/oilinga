import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, clearApiError, getApiState, subscribeSessionExpiry } from "@/lib/api-client";

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (name: string) => name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => body,
    } as unknown as Response;
}

const fetchMock: FetchMock = vi.fn();
const unsubscribers: Array<() => void> = [];

beforeEach(() => {
    window.localStorage.clear();
    clearApiError();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("apiFetch token refresh", () => {
    it("refreshes an expired access token once and retries the original request", async () => {
        window.localStorage.setItem("oilinga_access_token", "expired-access");
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "Invalid or expired access token" }))
            .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { accessToken: "fresh-access" } }))
            .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { ok: true } }));

        await expect(apiFetch<{ ok: boolean }>("/admin/dashboard")).resolves.toEqual({ ok: true });

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:4000/api/v1/auth/refresh");
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include" });
        const retryHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
        expect(retryHeaders.get("Authorization")).toBe("Bearer fresh-access");
        expect(window.localStorage.getItem("oilinga_access_token")).toBe("fresh-access");
        expect(getApiState().error).toBeNull();
    });

    it("silently redirects to login when the refresh token has also expired", async () => {
        window.localStorage.setItem("oilinga_access_token", "expired-access");
        const onExpired = vi.fn();
        unsubscribers.push(subscribeSessionExpiry(onExpired));
        const assign = vi.fn();
        vi.stubGlobal("location", { pathname: "/admin", search: "", hash: "", assign });
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "Invalid or expired access token" }))
            .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "Session is invalid or has expired" }));

        await expect(apiFetch("/admin/dashboard")).rejects.toMatchObject({
            name: "SessionExpiredError",
            message: "",
            status: 401,
        });

        expect(window.localStorage.getItem("oilinga_access_token")).toBeNull();
        expect(onExpired).toHaveBeenCalledTimes(1);
        expect(assign).toHaveBeenCalledWith(expect.stringContaining("/auth/login?next="));
        expect(getApiState().error).toBeNull();
    });

    it("shares one refresh request across concurrent unauthorized calls", async () => {
        window.localStorage.setItem("oilinga_access_token", "expired-access");
        let refreshed = false;
        let completeRefresh: (response: Response) => void = () => undefined;
        const pendingRefresh = new Promise<Response>(resolve => { completeRefresh = resolve; });
        fetchMock.mockImplementation((input: RequestInfo | URL) => {
            if (String(input).includes("/auth/refresh")) return pendingRefresh;
            return Promise.resolve(jsonResponse(refreshed ? 200 : 401, {
                success: refreshed,
                data: refreshed ? { ok: true } : undefined,
                message: refreshed ? undefined : "Invalid or expired access token",
            }));
        });

        const calls = [apiFetch("/admin/one"), apiFetch("/admin/two")];
        await Promise.resolve();
        await Promise.resolve();
        refreshed = true;
        completeRefresh(jsonResponse(200, { success: true, data: { accessToken: "shared-access" } }));
        await Promise.all(calls);

        expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/auth/refresh"))).toHaveLength(1);
        expect(window.localStorage.getItem("oilinga_access_token")).toBe("shared-access");
        expect(getApiState().error).toBeNull();
    });

    it("keeps authentication failures on login visible and refresh-free", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false, message: "Invalid email or password" }));

        await expect(apiFetch("/auth/login", { method: "POST", body: JSON.stringify({}) })).rejects.toMatchObject({
            status: 401,
            message: "Invalid email or password",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getApiState().error).toBe("Invalid email or password");
    });

    it("does not refresh or redirect anonymous requests", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false, message: "Authentication required" }));

        await expect(apiFetch("/auth/me")).rejects.toMatchObject({ status: 401, message: "Authentication required" });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getApiState().error).toBeNull();
    });
});
