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

    it("maps full admin subscription management actions to the dedicated endpoints", async () => {
        await mutateBackendData("admin-create-subscription", {
            userId: "user-1",
            shopId: "shop/1",
            plan: "growth",
            subscriptionStatus: "Active",
            billingCycle: "annual",
            nextBillingDate: "2027-01-01"
        });
        expect(apiFetch).toHaveBeenLastCalledWith("/admin/users/user-1/subscriptions", {
            method: "POST",
            body: JSON.stringify({
                shopId: "shop/1",
                plan: "growth",
                subscriptionStatus: "Active",
                billingCycle: "annual",
                nextBillingDate: "2027-01-01T00:00:00.000Z"
            })
        });

        await mutateBackendData("admin-update-subscription", {
            shopId: "shop/1",
            plan: "pro",
            nextBillingDate: null
        });
        expect(apiFetch).toHaveBeenLastCalledWith("/admin/subscriptions/shop%2F1", {
            method: "PATCH",
            body: JSON.stringify({ plan: "pro", nextBillingDate: null })
        });

        await mutateBackendData("admin-delete-subscription", { shopId: "shop/1" });
        expect(apiFetch).toHaveBeenLastCalledWith("/admin/subscriptions/shop%2F1", { method: "DELETE" });
    });

    it("rejects invalid subscription values before making a request", async () => {
        await expect(mutateBackendData("admin-create-subscription", { userId: "u1", plan: "enterprise" }))
            .rejects.toThrow("Unsupported subscription plan");
        await expect(mutateBackendData("admin-update-subscription", { shopId: "s1", billingCycle: "weekly" }))
            .rejects.toThrow("Unsupported billing cycle");
    });

    it("rejects invalid subscription statuses and unknown actions locally", async () => {
        await expect(mutateBackendData("admin-set-subscription-status", { shopId: "s1", status: "Unknown" }))
            .rejects.toThrow("Unsupported subscription status");
        await expect(mutateBackendData("not-an-action", {}))
            .rejects.toThrow("Unsupported backend write action");
        expect(apiFetch).not.toHaveBeenCalled();
    });
});

describe("readBackendData admin subscription views", () => {
    it("reads subscriptions and assignable users from the dedicated admin endpoints", async () => {
        await readBackendData("admin-subscriptions", { search: "zoe", status: "Paused", page: "2" });
        expect(apiFetch).toHaveBeenLastCalledWith("/admin/subscriptions?search=zoe&status=Paused&page=2");

        await readBackendData("admin-subscription-users", { limit: "100" });
        expect(apiFetch).toHaveBeenLastCalledWith("/admin/subscription-users?limit=100");
    });
});

describe("readBackendData product media view", () => {
    it("reads media from the dedicated endpoint", async () => {
        await readBackendData("product-media", { id: "p1" });
        expect(apiFetch).toHaveBeenCalledWith("/products/p1/media");
    });
});

describe("readBackendData marketplace categories", () => {
    const dbCategories = [
        { id: "db-palm", name: "Database Palm Oil", caption: "Stored in Postgres", glyph: "🫙" },
        { id: "db-shea", name: "Database Shea Oil", caption: "Stored in Postgres", glyph: "🌿" },
    ];

    function mockMarketplace(categories: unknown[], products: unknown[] = []) {
        apiFetch.mockImplementation(async (url: string) => {
            if (url === "/products?limit=100") return { items: products };
            if (url === "/shops") return [{ id: "s1", slug: "shop-1", name: "Shop One" }];
            if (url === "/products/categories") return categories;
            throw new Error(`Unexpected API call: ${url}`);
        });
    }

    it("uses database categories and derives shop categories from database products", async () => {
        mockMarketplace(dbCategories, [{
            id: "p1",
            slug: "p1",
            name: "Test oil",
            price: "1000",
            shop: { slug: "shop-1", name: "Shop One" },
            category: { id: "db-palm", name: "Database Palm Oil", glyph: "🫙" },
        }]);

        const result = await readBackendData<{
            categories: { id: string; name: string }[];
            shops: { categories: string[] }[];
        }>("marketplace");

        expect(result.categories).toEqual(dbCategories);
        expect(result.shops[0].categories).toEqual(["db-palm"]);
    });

    it("keeps an empty category list when the database has no categories", async () => {
        mockMarketplace([]);

        const result = await readBackendData<{ categories: unknown[] }>("marketplace");

        expect(result.categories).toEqual([]);
    });
});
