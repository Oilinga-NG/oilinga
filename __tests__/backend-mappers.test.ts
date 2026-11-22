import { describe, expect, it } from "vitest";
import {
    mapOrder,
    mapPaymentRecord,
    mapProduct,
    normalizePlanId,
    normalizeSubscriptionStatus,
} from "@/lib/backend-mappers";

describe("mapProduct", () => {
    it("parses formatted Naira price strings without producing NaN", () => {
        const product = mapProduct({
            id: "p1",
            slug: "palm-oil",
            name: "Palm oil",
            price: "₦1,250.50",
            shop: { name: "Test Shop", slug: "test-shop", verified: true },
        });
        expect(product.priceValue).toBe(1250.5);
        expect(product.price).toContain("1,250.5");
        expect(Number.isNaN(product.priceValue)).toBe(false);
    });

    it("falls back to zero when the backend price cannot be parsed", () => {
        const product = mapProduct({ id: "p2", slug: "p2", name: "Unpriced", price: "free" });
        expect(product.priceValue).toBe(0);
    });

    it("preserves gallery media ids and the primary flag", () => {
        const product = mapProduct({
            id: "p3",
            slug: "p3",
            name: "Groundnut oil",
            price: "1200",
            media: [{ id: "m1", url: "/assets/oil.jpg", alt: "Bottle", isPrimary: true }],
        });
        expect(product.media?.[0]).toMatchObject({ id: "m1", url: "/assets/oil.jpg", isPrimary: true });
    });
});

describe("mapOrder", () => {
    it("normalizes status, line items and formatted money values", () => {
        const order = mapOrder({
            id: "o1",
            orderNumber: "ORD-1",
            status: "PENDING",
            createdAt: "2026-01-01T00:00:00.000Z",
            paymentMethod: "paystack",
            payments: [{ status: "SUCCESS" }],
            items: [{
                productId: "p1",
                quantity: "2",
                unitPrice: "₦1,000.50",
                lineTotal: "₦2,001",
            }],
            subtotal: "₦2,001",
            total: "₦2,101",
            deliveryFee: "₦100",
        });
        expect(order.statusKey).toBe("PENDING");
        expect(order.status).toBe("New");
        expect(order.payment).toBe("card");
        expect(order.paymentStatus).toBe("SUCCESS");
        expect(order.items[0]).toMatchObject({ quantity: 2, unitPrice: 1000.5, lineTotal: 2001 });
        expect(order.subtotal).toBe(2001);
        expect(order.total).toBe(2101);
        expect(order.deliveryFee).toBe(100);
    });
});

describe("mapPaymentRecord", () => {
    it("maps payment and refund rows with numeric amounts", () => {
        const payment = mapPaymentRecord({
            id: "pay1",
            orderId: "o1",
            orderNumber: "ORD-1",
            provider: "paystack",
            status: "partially_refunded",
            amount: "₦5,000.75",
            currency: "NGN",
            reference: "PSK-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            refunds: [{ id: "r1", reference: "REF-1", amount: "₦500", status: "success" }],
        });
        expect(payment.provider).toBe("PAYSTACK");
        expect(payment.status).toBe("PARTIALLY_REFUNDED");
        expect(payment.amount).toBe(5000.75);
        expect(payment.refunds[0]).toMatchObject({ amount: 500, status: "SUCCESS" });
    });
});

describe("subscription normalization", () => {
    it("maps backend plan labels to canonical plan ids", () => {
        expect(normalizePlanId("FREE")).toBe("starter");
        expect(normalizePlanId("Starter")).toBe("starter");
        expect(normalizePlanId("growth")).toBe("growth");
        expect(normalizePlanId("PRO")).toBe("pro");
    });

    it("maps backend subscription statuses to UI labels", () => {
        expect(normalizeSubscriptionStatus("ACTIVE")).toBe("Active");
        expect(normalizeSubscriptionStatus("suspended")).toBe("Paused");
        expect(normalizeSubscriptionStatus("canceled")).toBe("Cancelled");
    });
});
