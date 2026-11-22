import { beforeEach, describe, expect, it, vi } from "vitest";
import { mutateBackendData, readBackendData } from "@/lib/backend-client";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiFetch }));

beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ ok: true });
});

describe("mutateBackendData action mapping", () => {
    it("posts contact enquiries to the public contact endpoint", async () => {
        await mutateBackendData("send-contact", {
            name: "Amina",
            email: "amina@example.com",
            subject: "Buyer support",
            message: "Please help with my order.",
        });
        expect(apiFetch).toHaveBeenCalledWith("/contact", {
            method: "POST",
            body: JSON.stringify({
                name: "Amina",
                email: "amina@example.com",
                subject: "Buyer support",
                message: "Please help with my order.",
            }),
        });
    });

    it("maps product media actions to the dedicated media endpoints", async () => {
        await mutateBackendData("list-product-media", { productId: "p/1" });
        expect(apiFetch).toHaveBeenLastCalledWith("/products/p%2F1/media");

        await mutateBackendData("add-product-media", { productId: "p1", media: { url: "/a.jpg", alt: "A", isPrimary: true } });
        expect(apiFetch).toHaveBeenLastCalledWith("/products/p1/media", {
            method: "POST",
            body: JSON.stringify({ url: "/a.jpg", alt: "A", isPrimary: true }),
        });

        await mutateBackendData("update-product-media", { productId: "p1", mediaId: "m 1", media: { alt: "Updated" } });
        expect(apiFetch).toHaveBeenLastCalledWith("/products/p1/media/m%201", {
            method: "PATCH",
            body: JSON.stringify({ alt: "Updated" }),
        });

        await mutateBackendData("remove-product-media", { productId: "p1", mediaId: "m1" });
        expect(apiFetch).toHaveBeenLastCalledWith("/products/p1/media/m1", { method: "DELETE" });

        await mutateBackendData("set-primary-product-media", { productId: "p1", mediaId: "m2" });
        expect(apiFetch).toHaveBeenLastCalledWith("/products/p1/media/m2", {
            method: "PATCH",
            body: JSON.stringify({ isPrimary: true }),
        });
    });

    it("maps moderator subscription updates without bypassing permission checks in the client", async () => {
        await mutateBackendData("admin-set-subscription-status", { shopId: "shop/7", status: "Paused" });
        expect(apiFetch).toHaveBeenCalledWith("/admin/subscriptions/shop%2F7/status", {
            method: "PATCH",
            body: JSON.stringify({ status: "Paused" }),
        });
    });

    it("rejects invalid subscription statuses and unknown actions locally", async () => {
        await expect(mutateBackendData("admin-set-subscription-status", { shopId: "s1", status: "Unknown" }))
            .rejects.toThrow("Unsupported subscription status");
        await expect(mutateBackendData("not-an-action", {}))
            .rejects.toThrow("Unsupported backend write action");
        expect(apiFetch).not.toHaveBeenCalled();
    });
});

describe("readBackendData product media view", () => {
    it("reads media from the dedicated endpoint", async () => {
        await readBackendData("product-media", { id: "p1" });
        expect(apiFetch).toHaveBeenCalledWith("/products/p1/media");
    });
});
