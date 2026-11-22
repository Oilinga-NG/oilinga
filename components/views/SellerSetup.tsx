"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { readBackendData, slugifyShopName, mutateBackendData } from "@/lib/backend-client";
import type { Category, ProductCategory, ProductMedia } from "@/lib/data";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { PLANS, getPlan, type BillingCycle } from "@/lib/subscription";
import { PlanCard } from "@/components/ui/PlanCard";

type ListingStatus = "Active" | "Draft" | "Out of stock";
type Listing = {
    id: string;
    dbId?: string;
    slug?: string;
    name: string;
    price: string;
    size: string;
    stock: string;
    category: ProductCategory;
    description: string;
    status: ListingStatus;
    imageUrl?: string | null;
    media?: ProductMedia[];
};
type SellerOrderStatus = "New" | "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Refunded";
type SellerOrder = {
    id: string;
    dbId?: string;
    orderNumber?: string;
    customer: string;
    customerEmail?: string;
    itemCount?: number;
    createdAt: string;
    total: number;
    subtotal?: number;
    status: SellerOrderStatus;
    paymentStatus?: string;
    items: { productId: string; name: string; quantity: number; unitPrice?: number; lineTotal?: number }[];
    delivery?: { name: string; phone: string; address: string; state?: string; notes?: string };
    events?: { id: string; note?: string; createdAt: string; toStatus: string }[];
};

type Pagination = { page: number; limit: number; total: number; pages: number };
type SellerRestrictions = {
    accountStatus: string;
    shopStatus: string;
    verified: boolean;
    published: boolean;
    canPublish: boolean;
    canManageInventory: boolean;
    canManageOrders: boolean;
    canEditProfile: boolean;
    reasons: string[];
};
type SellerOrderSummary = {
    id: string;
    orderNumber: string;
    status: string;
    statusLabel: string;
    customer: { name: string; email: string | null };
    items: { productId: string | null; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
    itemCount: number;
    subtotal: number;
    orderTotal: number;
    paymentStatus: string;
    paymentMethod: string | null;
    placedAt: string;
};
type DashboardData = {
    shop: { id: string; name: string; slug: string; verified: boolean; published: boolean; status: string; verificationRequestedAt: string | null };
    restrictions: SellerRestrictions;
    stats: {
        totalProducts: number; activeProducts: number; outOfStockProducts: number; lowStockProducts: number;
        totalOrders: number; pendingOrders: number; processingOrders: number; shippedOrders: number;
        completedOrders: number; cancelledOrders: number; refundedOrders: number;
        grossSales: number; commissionRate: number; commission: number; netEarnings: number;
        paidOut: number; availableBalance: number; unreadNotifications: number;
    };
    recentOrders: SellerOrderSummary[];
    lowStockProducts: { id: string; name: string; stock: number; status: string }[];
};
type AnalyticsData = {
    range: { days: number; from: string; to: string };
    summary: { revenue: number; orders: number; averageOrderValue: number; earnings: number; commissionRate: number };
    series: { date: string; orders: number; revenue: number; earnings: number }[];
};
type PerformanceData = {
    items: {
        id: string; name: string; slug: string; price: number; stock: number; status: string;
        imageUrl: string | null; category: string | null; unitsSold: number; orderCount: number; revenue: number;
    }[];
    summary: { totalProducts: number; totalUnitsSold: number; totalRevenue: number };
};
type InventoryItem = {
    id: string; name: string; slug: string; sku: string | null; price: number; stock: number;
    status: string; imageUrl: string | null; category: string | null; lowStock: boolean; stockValue: number;
};
type InventoryData = {
    items: InventoryItem[];
    summary: {
        totalProducts: number; activeProducts: number; outOfStockProducts: number;
        lowStockProducts: number; totalUnits: number; totalStockValue: number;
    };
    pagination: Pagination;
};
type SellerOrdersData = { items: SellerOrderSummary[]; pagination: Pagination; counts: Record<string, number> };
type EarningsData = {
    summary: {
        currency: string; commissionRate: number; grossSales: number; totalRefunds: number;
        commission: number; netEarnings: number; paidOut: number; availableBalance: number; totalOrders: number;
    };
    items: {
        id: string; type: "sale" | "refund" | "payout"; title: string; orderNumber: string | null;
        reference: string | null; date: string; gross: number; commission: number; net: number; status: string;
    }[];
    pagination: Pagination;
};
type NotificationItem = {
    id: string; type: string; title: string; message: string; data: unknown;
    read: boolean; readAt: string | null; createdAt: string;
};
type NotificationsData = { items: NotificationItem[]; pagination: Pagination; unreadCount: number };
type ShopProfileData = {
    shop: {
        id: string; name: string; slug: string; ownerName: string; location: string | null;
        tagline: string | null; description: string | null; verified: boolean; published: boolean;
        status: string; verificationRequestedAt: string | null; productCount: number; createdAt: string;
    };
    verification: { verified: boolean; requestedAt: string | null; canRequest: boolean; canPublish: boolean };
    restrictions: SellerRestrictions;
};

/** Sellers may progress or cancel; refunds remain an administrator action. */
const SELLER_TRANSITIONS: Record<SellerOrderStatus, SellerOrderStatus[]> = {
    New: ["Processing", "Cancelled"],
    Processing: ["Shipped", "Cancelled"],
    Shipped: ["Delivered"],
    Delivered: [],
    Cancelled: [],
    Refunded: []
};

const SELLER_STATUS_TONE: Record<SellerOrderStatus, BadgeTone> = {
    New: "blue",
    Processing: "pending",
    Shipped: "shipped",
    Delivered: "delivered",
    Cancelled: "red",
    Refunded: "neutral"
};
type ShopSetup = {
    id?: string;
    slug?: string;
    shop: string;
    owner: string;
    location: string;
    tagline: string;
    description?: string;
    products: Listing[];
    orders: SellerOrder[];
    plan: "Free";
    published: boolean;
    verified?: boolean;
    verificationRequestedAt?: string | null;
    status?: "Active" | "Paused";
};
type Stage = "landing" | "register" | "products" | "dashboard";
type WorkspaceTab = "overview" | "analytics" | "products" | "inventory" | "orders" | "earnings" | "notifications" | "subscription" | "settings";

type ProductDraft = Omit<Listing, "id" | "dbId" | "status">;
const blankProduct: ProductDraft = { name: "", price: "", size: "", stock: "", category: "crude-palm", description: "", imageUrl: "", media: [] };

function mediaToText(media?: ProductMedia[]) {
    return (media ?? []).map(item => item.url).join("\n");
}

function textToMedia(value: string): ProductMedia[] {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(url => ({ url }));
}

const ORDER_STATUS_TO_SELLER: Record<string, SellerOrderStatus> = {
    PENDING: "New", PROCESSING: "Processing", SHIPPED: "Shipped",
    DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded"
};

function toSellerOrder(row: SellerOrderSummary): SellerOrder {
    return {
        id: row.id,
        dbId: row.id,
        orderNumber: row.orderNumber,
        customer: row.customer.name,
        customerEmail: row.customer.email ?? undefined,
        itemCount: row.itemCount,
        createdAt: row.placedAt,
        total: row.subtotal,
        subtotal: row.subtotal,
        status: ORDER_STATUS_TO_SELLER[row.status] ?? "New",
        paymentStatus: row.paymentStatus,
        items: row.items.map(item => ({
            productId: item.productId ?? "", name: item.name, quantity: item.quantity,
            unitPrice: item.unitPrice, lineTotal: item.lineTotal
        }))
    };
}

function displayListingStatus(status: string): ListingStatus {
    const value = String(status ?? "").toLowerCase();
    if (value === "active") return "Active";
    if (value === "out_of_stock" || value === "out of stock") return "Out of stock";
    return "Draft";
}

function shortDate(value: string) {
    return new Date(value).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function notificationIcon(type: string): "shield" | "receipt" | "wallet" | "box" | "bell" {
    const value = type.toUpperCase();
    if (value.includes("STOCK")) return "box";
    if (value.includes("PAYMENT") || value.includes("REFUND") || value.includes("PAYOUT")) return "wallet";
    if (value.includes("ORDER")) return "receipt";
    if (value.includes("VERIFICATION") || value.includes("SUSPENSION") || value.includes("PROFILE")) return "shield";
    return "bell";
}

const workspaceTabs: { id: WorkspaceTab; label: string; icon: "grid" | "box" | "archive" | "receipt" | "wallet" | "sparkle" | "settings" | "chart" | "bell" }[] = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "analytics", label: "Analytics", icon: "chart" },
    { id: "products", label: "Products", icon: "box" },
    { id: "inventory", label: "Inventory", icon: "archive" },
    { id: "orders", label: "Orders", icon: "receipt" },
    { id: "earnings", label: "Earnings", icon: "wallet" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "subscription", label: "Subscription", icon: "sparkle" },
    { id: "settings", label: "Shop settings", icon: "settings" },
];
const steps = [
    { number: "01", title: "Register your shop", copy: "Add your business name, owner details and location." },
    { number: "02", title: "List your products", copy: "Set product names, pack sizes, prices and available stock." },
    { number: "03", title: "Publish and grow", copy: "Publish your products and manage your shop from one place." },
];

function ProductImageFields({ value, onChange }: {
    value: ProductDraft;
    onChange: (patch: Partial<ProductDraft>) => void;
}) {
    return <>
        <label className="oi-seller-setup__field">Primary image URL
            <input value={value.imageUrl ?? ""} onChange={event => onChange({ imageUrl: event.target.value })} placeholder="https://… or /assets/…" />
        </label>
        <label className="oi-seller-setup__field">Gallery image URLs
            <textarea rows={3} value={mediaToText(value.media)} onChange={event => onChange({ media: textToMedia(event.target.value) })} placeholder="One URL per line" />
        </label>
    </>;
}

function ProductEditor({ item, categories, onSave, onDelete, busy = false }: {
    item: Listing;
    categories: Category[];
    onSave: (patch: Partial<Listing>) => void;
    onDelete: () => void;
    busy?: boolean;
}) {
    const [draft, setDraft] = useState<Listing>(item);
    const [mediaText, setMediaText] = useState(mediaToText(item.media));
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setDraft(item);
        setMediaText(mediaToText(item.media));
    }, [item]);

    function save() {
        onSave({ ...draft, media: textToMedia(mediaText) });
    }

    return (
        <article className="oi-seller-product-editor">
            <div className="oi-seller-product-editor__top">
                {draft.imageUrl && <img className="oi-seller-product-editor__image" src={draft.imageUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
                <div className="oi-seller-product-editor__summary">
                    <h3>{draft.name}</h3>
                    <p>{draft.size} · {draft.stock} in stock</p>
                    <span className={`oi-seller-dashboard__status oi-seller-dashboard__status--${draft.status === "Active" ? "active" : "draft"}`}>{draft.status}</span>
                </div>
                <strong>₦{Number(draft.price || 0).toLocaleString("en-NG")}</strong>
                <button className="oi-seller-dashboard__text-button" type="button" disabled={busy} onClick={() => setExpanded(!expanded)}>{expanded ? "Close" : "Edit"}</button>
                <button className="oi-seller-dashboard__text-button oi-seller-dashboard__text-button--danger" type="button" disabled={busy} onClick={onDelete}>Delete</button>
            </div>
            {expanded && <div className="oi-seller-product-editor__fields">
                <label className="oi-seller-setup__field">Product name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
                <label className="oi-seller-setup__field">Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="oi-seller-setup__field">Description<textarea rows={3} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
                <label className="oi-seller-setup__field">Price (₦)<input type="number" min="1" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></label>
                <label className="oi-seller-setup__field">Pack size<input value={draft.size} onChange={event => setDraft({ ...draft, size: event.target.value })} /></label>
                <label className="oi-seller-setup__field">Stock<input type="number" min="0" value={draft.stock} onChange={event => setDraft({ ...draft, stock: event.target.value })} /></label>
                <label className="oi-seller-setup__field">Listing status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as ListingStatus })}><option>Active</option><option>Draft</option><option>Out of stock</option></select></label>
                <label className="oi-seller-setup__field">Primary image URL<input value={draft.imageUrl ?? ""} onChange={event => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="https://… or /assets/…" /></label>
                <label className="oi-seller-setup__field">Gallery image URLs<textarea rows={3} value={mediaText} onChange={event => setMediaText(event.target.value)} placeholder="One URL per line" /></label>
                <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
            </div>}
        </article>
    );
}

function StockControl({ productId, stock, busy, disabled, onSave }: {
    productId: string; stock: number; busy: boolean; disabled: boolean; onSave: (productId: string, stock: number) => void;
}) {
    const [value, setValue] = useState(String(stock));
    useEffect(() => { setValue(String(stock)); }, [stock]);
    function commit() {
        const next = Number(value);
        if (Number.isFinite(next) && next >= 0 && next !== stock) onSave(productId, next);
    }
    return (
        <div className="oi-seller-stock-control">
            <button type="button" aria-label={`Decrease stock for ${productId}`} disabled={disabled || busy} onClick={() => { const next = Math.max(0, Number(value || 0) - 1); setValue(String(next)); onSave(productId, next); }}>−</button>
            <input aria-label={`Stock for ${productId}`} type="number" min="0" value={value} disabled={disabled || busy} onChange={event => setValue(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />
            <button type="button" aria-label={`Increase stock for ${productId}`} disabled={disabled || busy} onClick={() => { const next = Number(value || 0) + 1; setValue(String(next)); onSave(productId, next); }}>+</button>
        </div>
    );
}

function SalesBars({ series, compact = false }: { series: AnalyticsData["series"]; compact?: boolean }) {
    const max = Math.max(1, ...series.map(point => point.revenue));
    return (
        <div className={`oi-seller-chart${compact ? " oi-seller-chart--compact" : ""}`} role="img" aria-label="Daily sales revenue">
            {series.map(point => (
                <div className="oi-seller-chart__bar" key={point.date} title={`${point.date}: ${point.orders} orders · ₦${point.revenue.toLocaleString("en-NG")}`}>
                    <div className="oi-seller-chart__fill" style={{ height: `${point.revenue > 0 ? Math.max(8, (point.revenue / max) * 100) : 3}%` }} />
                    <span>{shortDate(point.date)}</span>
                </div>
            ))}
        </div>
    );
}

function Pager({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
    return (
        <div className="oi-seller-pager">
            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button>
            <span>Page {pagination.page} of {pagination.pages} · {pagination.total} total</span>
            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</button>
        </div>
    );
}

export function SellerSetup() {
    const { user, ready: authReady, refreshUser } = useAuth();
    const router = useRouter();
    const userId = user?.id;
    const userRole = user?.role;
    const { refresh: refreshMarketplace, categories } = useMarketplaceData();
    const [setup, setSetup] = useState<ShopSetup | null>(null);
    const [stage, setStage] = useState<Stage>("landing");
    const [loaded, setLoaded] = useState(false);
    const [shop, setShop] = useState("");
    const [owner, setOwner] = useState("");
    const [location, setLocation] = useState("");
    const [tagline, setTagline] = useState("");
    const [product, setProduct] = useState(blankProduct);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
    const [productFormOpen, setProductFormOpen] = useState(false);
    const [landingCycle, setLandingCycle] = useState<BillingCycle>("monthly");
    const [showDeleteShop, setShowDeleteShop] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [orderBusy, setOrderBusy] = useState("");
    const [settingsDraft, setSettingsDraft] = useState({ shop: "", owner: "", location: "", tagline: "", description: "" });
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [performance, setPerformance] = useState<PerformanceData | null>(null);
    const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
    const [ordersData, setOrdersData] = useState<SellerOrdersData | null>(null);
    const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
    const [notificationsData, setNotificationsData] = useState<NotificationsData | null>(null);
    const [shopProfile, setShopProfile] = useState<ShopProfileData | null>(null);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const [analyticsDays, setAnalyticsDays] = useState(30);
    const [orderStatus, setOrderStatus] = useState("ALL");
    const [orderPage, setOrderPage] = useState(1);
    const [orderSearch, setOrderSearch] = useState("");
    const [inventorySearch, setInventorySearch] = useState("");
    const [inventoryPage, setInventoryPage] = useState(1);
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [transactionPage, setTransactionPage] = useState(1);
    const [notificationPage, setNotificationPage] = useState(1);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [stockBusy, setStockBusy] = useState("");

    async function loadAnalyticsPanel(days = analyticsDays) {
        try { setAnalytics(await readBackendData<AnalyticsData>("seller-analytics", { days: String(days) })); }
        catch { setAnalytics(null); }
    }

    async function loadOrdersPanel(page = orderPage, status = orderStatus, search = orderSearch) {
        const params: Record<string, string> = { limit: "20", page: String(page) };
        if (status !== "ALL") params.status = status;
        if (search.trim()) params.search = search.trim();
        try { setOrdersData(await readBackendData<SellerOrdersData>("seller-orders", params)); }
        catch { setOrdersData(null); }
    }

    async function loadInventoryPanel(page = inventoryPage, search = inventorySearch, onlyLow = lowStockOnly) {
        const params: Record<string, string> = { limit: "100", page: String(page) };
        if (search.trim()) params.search = search.trim();
        if (onlyLow) params.lowStock = "true";
        try {
            const data = await readBackendData<InventoryData>("seller-inventory", params);
            setInventoryData(data);
            if (data.items.length) {
                setSetup(current => current ? {
                    ...current,
                    products: current.products.map(item => {
                        const match = data.items.find(row => row.id === item.dbId || row.id === item.id);
                        return match ? {
                            ...item,
                            name: match.name,
                            price: String(match.price),
                            stock: String(match.stock),
                            status: displayListingStatus(match.status),
                            imageUrl: match.imageUrl ?? item.imageUrl
                        } : item;
                    })
                } : current);
            }
        } catch { setInventoryData(null); }
    }

    async function loadEarningsPanel(page = transactionPage) {
        try { setEarningsData(await readBackendData<EarningsData>("seller-earnings", { page: String(page), limit: "10" })); }
        catch { setEarningsData(null); }
    }

    async function loadNotificationsPanel(page = notificationPage, onlyUnread = unreadOnly) {
        try {
            setNotificationsData(await readBackendData<NotificationsData>("seller-notifications", {
                limit: "20", page: String(page), ...(onlyUnread ? { unreadOnly: "true" } : {})
            }));
        } catch { setNotificationsData(null); }
    }

    async function loadWorkspace() {
        setWorkspaceLoading(true);
        try {
            const [dashboardResult, performanceResult, profileResult] = await Promise.allSettled([
                readBackendData<DashboardData>("seller-dashboard"),
                readBackendData<PerformanceData>("seller-performance"),
                readBackendData<ShopProfileData>("seller-shop"),
                loadAnalyticsPanel(),
                loadOrdersPanel(),
                loadInventoryPanel(),
                loadEarningsPanel(),
                loadNotificationsPanel()
            ]);
            if (dashboardResult.status === "fulfilled") {
                setDashboard(dashboardResult.value);
                setSetup(current => current ? {
                    ...current,
                    verified: current.verified || dashboardResult.value.shop.verified,
                    published: current.published || dashboardResult.value.shop.published,
                    status: dashboardResult.value.shop.status === "SUSPENDED" ? "Paused" : "Active",
                    orders: dashboardResult.value.recentOrders.map(toSellerOrder)
                } : current);
            }
            if (performanceResult.status === "fulfilled") setPerformance(performanceResult.value);
            if (profileResult.status === "fulfilled") {
                setShopProfile(profileResult.value);
                const shop = profileResult.value.shop;
                setSettingsDraft({
                    shop: shop.name, owner: shop.ownerName, location: shop.location ?? "",
                    tagline: shop.tagline ?? "", description: shop.description ?? ""
                });
            }
        } finally { setWorkspaceLoading(false); }
    }

    async function loadSellerData() {
        const result = await readBackendData<{ shop: Record<string, any> | null; orders: SellerOrder[] }>("seller");
        const row = result.shop;
        if (!row) { setSetup(null); return null; }
        const existing: ShopSetup = {
            id: row.id ? String(row.id) : undefined,
            slug: row.slug,
            shop: row.name,
            owner: row.owner,
            location: row.location ?? "",
            tagline: row.tagline ?? "",
            description: row.description ?? "",
            products: (row.products ?? []).map((item: Record<string, any>) => ({
                ...item,
                id: String(item.id ?? ""),
                dbId: item.dbId ? String(item.dbId) : undefined,
                slug: item.slug,
                category: item.category ?? "crude-palm",
                description: item.description ?? item.name ?? "",
                status: item.status ?? "Draft",
                imageUrl: item.imageUrl ?? null,
                media: item.media ?? []
            })),
            orders: result.orders,
            plan: "Free",
            published: Boolean(row.published),
            verified: Boolean(row.verified),
            verificationRequestedAt: row.verificationRequestedAt ?? null,
            status: row.status ?? "Active"
        };
        setSetup(existing);
        await loadWorkspace();
        return existing;
    }

    useEffect(() => {
        if (!authReady) return;
        let cancelled = false;
        setLoaded(false);
        async function loadShop() {
            try {
                if (!userId) {
                    if (!cancelled) { setSetup(null); setStage("landing"); }
                    return;
                }
                if (userRole !== "seller" && userRole !== "admin" && userRole !== "customer") { if (!cancelled) setSetup(null); return; }
                const existing = await loadSellerData();
                if (!cancelled && existing) setStage(existing.published ? "dashboard" : "products");
                else if (!cancelled) setStage("landing");
            } catch (loadError) {
                console.error("Seller data could not be loaded", loadError);
                if (!cancelled) { setSetup(null); setStage("landing"); }
            } finally { if (!cancelled) setLoaded(true); }
        }
        void loadShop();
        return () => { cancelled = true; };
    }, [authReady, userId, userRole, refreshUser]);

    useEffect(() => {
        if (!setup) return;
        setSettingsDraft({ shop: setup.shop, owner: setup.owner, location: setup.location, tagline: setup.tagline, description: setup.description ?? "" });
    }, [setup?.id]);

    async function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!shop.trim() || !owner.trim() || !location.trim()) return;
        setSaving(true);
        try {
            await mutateBackendData("create-shop", {
                shop: { name: shop.trim(), slug: slugifyShopName(shop.trim()), ownerName: owner.trim(), location: location.trim(), tagline: tagline.trim(), description: "" }
            });
            if (user?.role === "customer") await refreshUser();
            const existing = await loadSellerData();
            setError("");
            if (existing) setStage("products");
        } catch (registrationError) {
            setError(registrationError instanceof Error ? registrationError.message : "Could not register your shop.");
        } finally { setSaving(false); }
    }

    async function addProduct(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (
            !setup ||
            !product.name.trim() ||
            Number(product.price) <= 0 ||
            !product.size.trim() ||
            !product.description.trim() ||
            Number(product.stock) < 0
        ) {
            setError("Enter a product name, size, positive price and stock quantity.");
            return false;
        }
        setSaving(true);
        try {
            const status: ListingStatus = setup.verified && setup.status !== "Paused" && Number(product.stock) > 0 ? "Active" : "Draft";
            await mutateBackendData("create-product", {
                product: { ...product, name: product.name.trim(), shopId: setup.id, status }
            });
            await loadSellerData();
            await refreshMarketplace();
            setProduct(blankProduct);
            setError("");
            return true;
        } catch (productError) {
            setError(productError instanceof Error ? productError.message : "Could not add this product.");
            return false;
        } finally { setSaving(false); }
    }

    async function publishShop() {
        if (!setup?.products.length) return;
        setSaving(true);
        try {
            if (!setup.verified) {
                await mutateBackendData("request-verification", {});
                await loadSellerData();
                setError("Verification requested. An administrator will review your shop before you can publish.");
            } else {
                await mutateBackendData("set-shop-publication", { publication: { published: true, activateProducts: true } });
                await loadSellerData();
                await refreshMarketplace();
                setError("");
                setStage("dashboard");
            }
        } catch (publishError) {
            setError(publishError instanceof Error ? publishError.message : "Could not publish your shop.");
        } finally { setSaving(false); }
    }

    async function requestVerification() {
        if (!setup) return;
        setSaving(true);
        try {
            await mutateBackendData("seller-request-verification", {});
            await loadSellerData();
            setError("Verification requested. An administrator will review your shop before you can publish.");
        } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : "Could not request verification.");
        } finally { setSaving(false); }
    }

    async function updateProduct(productId: string, patch: Partial<Listing>) {
        if (!setup) return;
        setSaving(true);
        try {
            const current = setup.products.find(item => item.id === productId || item.dbId === productId);
            if (!current) return;
            const merged = { ...current, ...patch };
            await mutateBackendData("update-product", { id: merged.dbId ?? merged.id, product: { ...merged, shopId: setup.id } });
            await loadSellerData();
            await refreshMarketplace();
            setError("");
        } catch (productError) {
            setError(productError instanceof Error ? productError.message : "Could not update this product.");
        } finally { setSaving(false); }
    }

    async function deleteProduct(item: Listing) {
        if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
        setSaving(true);
        try {
            await mutateBackendData("delete-product", { id: item.dbId ?? item.id });
            await loadSellerData();
            await refreshMarketplace();
            setError("");
        } catch (productError) {
            setError(productError instanceof Error ? productError.message : "Could not delete this product.");
        } finally { setSaving(false); }
    }

    async function updateShop() {
        if (!setup) return;
        setSaving(true);
        try {
            await mutateBackendData("seller-update-shop", {
                shop: {
                    name: settingsDraft.shop,
                    ownerName: settingsDraft.owner,
                    location: settingsDraft.location,
                    tagline: settingsDraft.tagline,
                    description: settingsDraft.description
                }
            });
            await loadSellerData();
            await refreshMarketplace();
            setError("");
        } catch (shopError) {
            setError(shopError instanceof Error ? shopError.message : "Could not update your shop profile.");
        } finally { setSaving(false); }
    }

    async function setPublication(published: boolean) {
        setSaving(true);
        try {
            await mutateBackendData("set-shop-publication", { publication: { published, activateProducts: published } });
            await loadSellerData();
            await refreshMarketplace();
            setError("");
            if (published) setStage("dashboard");
        } catch (publicationError) {
            setError(publicationError instanceof Error ? publicationError.message : "Could not update publication settings.");
        } finally { setSaving(false); }
    }

    async function updateOrderStatus(orderId: string, status: SellerOrderStatus) {
        if (!setup || orderBusy) return;
        setOrderBusy(orderId);
        try {
            await mutateBackendData("seller-update-order-status", { orderId, status });
            await loadSellerData();
            setError("");
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "Could not update this order.");
        } finally {
            setOrderBusy("");
        }
    }

    async function cancelSellerOrder(orderId: string) {
        if (!setup || orderBusy) return;
        if (!window.confirm("Cancel this order? Reserved stock will be returned to your shop.")) return;
        setOrderBusy(orderId);
        try {
            await mutateBackendData("seller-update-order-status", { orderId, status: "CANCELLED", note: "Cancelled by seller" });
            await loadSellerData();
            setError("");
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : "Could not cancel this order.");
        } finally {
            setOrderBusy("");
        }
    }

    async function updateStock(productId: string, stock: number) {
        if (!setup || stockBusy || !Number.isFinite(stock) || stock < 0) return;
        setStockBusy(productId);
        try {
            await mutateBackendData("seller-update-stock", { productId, stock });
            await loadSellerData();
            setError("");
        } catch (stockError) {
            setError(stockError instanceof Error ? stockError.message : "Could not update stock.");
        } finally { setStockBusy(""); }
    }

    async function readNotification(id: string) {
        try {
            await mutateBackendData("seller-read-notification", { id });
            await loadSellerData();
        } catch (notificationError) {
            setError(notificationError instanceof Error ? notificationError.message : "Could not update this notification.");
        }
    }

    async function readAllNotifications() {
        try {
            await mutateBackendData("seller-read-all-notifications", {});
            await loadSellerData();
        } catch (notificationError) {
            setError(notificationError instanceof Error ? notificationError.message : "Could not update notifications.");
        }
    }

    function formatMoney(value: number) {
        return `₦${value.toLocaleString("en-NG")}`;
    }

    async function deleteShop() {
        setDeleting(true);
        try {
            await mutateBackendData("delete-shop", {});
            await refreshUser();
            await refreshMarketplace(); // ← flush marketplace cache immediately
            setStage("landing");
            setSetup(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete your shop.");
        } finally {
            setDeleting(false);
            setShowDeleteShop(false);
            setDeleteConfirmText("");
        }
    }

    function productRow(item: Listing) {
        return (
            <ProductEditor
                key={item.dbId ?? item.id}
                item={item}
                categories={categories}
                busy={saving}
                onSave={patch => { void updateProduct(item.dbId ?? item.id, patch); }}
                onDelete={() => { void deleteProduct(item); }}
            />
        );
    }

    if (!authReady || !loaded) {
        return <LoadingState label="Preparing your seller workspace" />;
    }

    if (!user && stage !== "landing") return <section className="oi-view oi-container oi-seller-setup"><div className="oi-seller-setup__card"><span className="oi-eyebrow oi-eyebrow--green">SELLER ACCOUNT</span><h1 className="oi-seller-setup__title">Sign in to create your shop</h1><p className="oi-seller-setup__lede">Your shop, products and orders are saved to your account so you can manage them from any device.</p><div className="oi-seller-setup__actions"><Link className="oi-btn oi-btn--primary" href="/auth/signup?next=%2Fseller">Create account</Link><Link className="oi-btn oi-btn--outline" href="/auth/login?next=%2Fseller">Sign in</Link></div></div></section>;


    if (stage === "landing") {
        function handleCreateShop() {
            if (!user) { router.push("/auth/signup?next=%2Fseller"); return; }
            setStage("register");
        }
        return (
            <section className="oi-view oi-container oi-seller-landing">
                <div className="oi-hero oi-seller-landing__hero">
                    <div className="oi-hero__copy oi-seller-landing__copy">
                        <span className="oi-eyebrow">SELL ON OILINGA</span>
                        <h1 className="oi-hero__title">Your harvest deserves a <em>bigger market.</em></h1>
                        <p className="oi-hero__lede">Open a shop, list your oils and reach buyers looking for trusted local producers.</p>
                        <div className="oi-hero__actions">
                            <button className="oi-btn oi-btn--gold" type="button" onClick={handleCreateShop}>
                                {user ? "Create your shop" : "Get started free"} <Icon name="arrow-right" size={16} />
                            </button>
                            <a className="oi-btn oi-btn--glass" href="#seller-how-it-works">How it works</a>
                        </div>
                        <div className="oi-hero__proof">
                            {user ? <><span>✦ Signed in as {user.name.split(" ")[0]}</span><span>✦ Set up in minutes</span></> : <><span>✦ Free to get started</span><span>✦ Set up in minutes</span></>}
                        </div>
                    </div>
                    <div className="oi-hero__photo oi-seller-landing__photo" aria-hidden="true">
                        <img src="/assets/brand/oilinga-brand-visual-reference.png" alt="" />
                    </div>
                </div>

                {!user && (
                    <div className="oi-seller-landing__auth-nudge">
                        <Icon name="user" size={18} />
                        <span>Already have an account?</span>
                        <Link href="/auth/login?next=%2Fseller" className="oi-btn oi-btn--outline oi-btn--sm">Sign in to your shop</Link>
                    </div>
                )}

                <div id="seller-how-it-works" className="oi-seller-landing__how">
                    <div className="oi-section__head"><div><span className="oi-eyebrow oi-eyebrow--green">A SIMPLE WAY TO START</span><h2 className="oi-section__title">From producer to storefront</h2></div></div>
                    <div className="oi-seller-landing__steps">
                        {steps.map((item) => (
                            <article className="oi-seller-landing__step" key={item.number}>
                                <span className="oi-seller-landing__number">{item.number}</span>
                                <h3>{item.title}</h3>
                                <p>{item.copy}</p>
                            </article>
                        ))}
                    </div>
                </div>

                <section id="seller-plans" className="oi-seller-landing__plans" aria-labelledby="seller-plans-title">
                    <div className="oi-pricing-head">
                        <span className="oi-eyebrow oi-eyebrow--green">Transparent pricing</span>
                        <h2 id="seller-plans-title" className="oi-pricing-head__title" style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}>
                            Pick the plan that fits
                        </h2>
                        <p className="oi-pricing-head__lede">Start free and upgrade as your shop grows.</p>

                        {/* Billing toggle — same as pricing page */}
                        <div className="oi-pricing-toggle" role="group" aria-label="Billing cycle">
                            <button
                                type="button"
                                className={`oi-pricing-toggle__btn ${landingCycle === "monthly" ? "is-active" : ""}`}
                                onClick={() => setLandingCycle("monthly")}
                            >
                                Monthly
                            </button>
                            <button
                                type="button"
                                className={`oi-pricing-toggle__btn ${landingCycle === "annual" ? "is-active" : ""}`}
                                onClick={() => setLandingCycle("annual")}
                            >
                                Annual
                                <span className="oi-pricing-toggle__save">Save 2 months</span>
                            </button>
                        </div>
                    </div>

                    <div className="oi-pricing-grid">
                        {PLANS.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                cycle={landingCycle}
                                full={false}
                                isAuth={Boolean(user)}
                                onStartFree={plan.monthlyPrice === 0 ? handleCreateShop : undefined}
                            />
                        ))}
                    </div>

                    <div className="oi-pricing-commission">
                        <Icon name="shield" size={18} />
                        <p>Commission: <strong>Starter 4% · Growth 2.5% · Pro 1.5%</strong>. Deducted before settlement.</p>
                    </div>
                </section>

                <section className="oi-seller-landing__callout">
                    <div>
                        <span className="oi-eyebrow">READY WHEN YOU ARE</span>
                        <h2>Let's get your shop started.</h2>
                        <p>Register your business first. You can add products and publish once your shop details are in.</p>
                    </div>
                    <button className="oi-btn oi-btn--gold" type="button" onClick={handleCreateShop}>
                        {user ? "Create your shop" : "Get started free"} <Icon name="arrow-right" size={16} />
                    </button>
                </section>
            </section>
        );
    }

    if (stage === "register") {
        return (
            <section className="oi-view oi-container oi-seller-setup">
                <div className="oi-seller-setup__card">
                    <button className="oi-seller-setup__back" type="button" onClick={() => setStage("landing")}>
                        <Icon name="arrow-left" size={15} /> Back to seller overview
                    </button>
                    <span className="oi-eyebrow oi-eyebrow--green">STEP 1 OF 3 · SHOP DETAILS</span>
                    <h1 className="oi-seller-setup__title">Register your shop</h1>
                    <p className="oi-seller-setup__lede">Tell buyers about your business. You can add products after registration.</p>
                    <form onSubmit={register}>
                        <label className="oi-seller-setup__field">Shop or business name<input required value={shop} onChange={e => setShop(e.target.value)} placeholder="e.g. Sunrise Palm Oils" /></label>
                        <label className="oi-seller-setup__field">Your name<input required value={owner} onChange={e => setOwner(e.target.value)} placeholder="Business owner" /></label>
                        <label className="oi-seller-setup__field">Business location<input required value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State / Region" /></label>
                        <label className="oi-seller-setup__field">Short shop introduction<input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="What do you make or sell?" /></label>
                        {error && <p role="alert" className="oi-seller-setup__error">{error}</p>}
                        <button className="oi-btn oi-btn--primary" type="submit" disabled={saving}>{saving ? "Registering…" : "Register and continue"} <Icon name="arrow-right" size={16} /></button>
                    </form>
                </div>
            </section>
        );
    }

    if (stage === "products" && setup) {
        const currentPlan = getPlan(setup.plan?.toLowerCase() ?? "starter");
        const limit = currentPlan?.listingLimit ?? 5;
        const atLimit = limit !== -1 && setup.products.length >= limit;
        return (
            <section className="oi-view oi-container oi-seller-setup">
                <div className="oi-seller-setup__card">
                    <span className="oi-eyebrow oi-eyebrow--green">STEP 2 OF 3 · PRODUCT LISTING</span>
                    <h1 className="oi-seller-setup__title">Add products to {setup.shop}</h1>
                    <p className="oi-seller-setup__lede">Your shop is registered. Add at least one product before publishing your storefront.</p>
                    <div className="oi-seller-setup__steps"><b>Shop registered</b><span>→ Add products → Publish</span></div>
                    {atLimit && (
                        <div className="oi-seller-upgrade-banner">
                            <Icon name="sparkle" size={18} />
                            <div><strong>You've reached your {limit}-product limit on the {currentPlan?.name} plan.</strong><span>Upgrade to list more products.</span></div>
                            <Link href="/seller/pricing" className="oi-btn oi-btn--gold oi-btn--sm">Upgrade plan</Link>
                        </div>
                    )}
                    {!atLimit && <form onSubmit={addProduct}>
                        <label className="oi-seller-setup__field">Product name<input required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} placeholder="Product name" /></label>
                        <label className="oi-seller-setup__field">Category<select required value={product.category} onChange={e => setProduct({ ...product, category: e.target.value as ProductCategory })}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                        <label className="oi-seller-setup__field">Product description<textarea required value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} rows={3} /></label>
                        <div className="oi-seller-setup__product-fields">
                            <label className="oi-seller-setup__field">Price (₦)<input required type="number" min="1" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></label>
                            <label className="oi-seller-setup__field">Pack size<input required value={product.size} onChange={e => setProduct({ ...product, size: e.target.value })} placeholder="5 litres" /></label>
                            <label className="oi-seller-setup__field">Stock quantity<input required type="number" min="0" value={product.stock} onChange={e => setProduct({ ...product, stock: e.target.value })} /></label>
                        </div>
                        <ProductImageFields value={product} onChange={patch => setProduct(current => ({ ...current, ...patch }))} />
                        {error && <p role="alert" className="oi-seller-setup__error">{error}</p>}
                        <button className="oi-btn oi-btn--outline" type="submit" disabled={saving}>{saving ? "Saving…" : "Add product"}</button>
                    </form>}
                    <div className="oi-seller-setup__verification">
                        <div>
                            <b>{setup.verified ? "Shop verified" : setup.verificationRequestedAt ? "Verification requested" : "Verification required"}</b>
                            <span>{setup.verified ? "You can publish your shop and activate products." : setup.verificationRequestedAt ? "An administrator will review your shop before publication." : "Request verification so an administrator can approve your shop."}</span>
                        </div>
                        {!setup.verified && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={saving} onClick={() => void requestVerification()}>{saving ? "Sending…" : setup.verificationRequestedAt ? "Request again" : "Request verification"}</button>}
                    </div>
                    <h2 className="oi-seller-setup__products-title">Products ({setup.products.length}{limit !== -1 ? ` / ${limit}` : ""})</h2>
                    {setup.products.length === 0 ? (
                        <p className="oi-seller-setup__empty">No products listed yet.</p>
                    ) : (
                        <div className="oi-seller-dashboard__product-list">{setup.products.map(productRow)}</div>
                    )}
                    <button className="oi-btn oi-btn--primary" type="button" disabled={!setup.products.length || saving} onClick={() => void publishShop()}>
                        {saving ? "Working…" : setup.verified ? "Publish shop and products" : "Request verification"} <Icon name="arrow-right" size={16} />
                    </button>
                </div>
            </section>
        );
    }

    if (stage === "dashboard" && setup?.published) {
        const inventory = setup.products.reduce((total, item) => total + Number(item.stock || 0), 0);
        const delivered = setup.orders.filter(order => order.status === "Delivered").reduce((total, order) => total + order.total, 0);
        const pending = setup.orders.filter(order => order.status !== "Delivered" && order.status !== "Cancelled").reduce((total, order) => total + order.total, 0);
        const stats = dashboard?.stats;
        const restrictions = dashboard?.restrictions ?? shopProfile?.restrictions;
        const canManageInventory = restrictions?.canManageInventory ?? setup.status !== "Paused";
        const canManageOrders = restrictions?.canManageOrders ?? setup.status !== "Paused";
        const canEditProfile = restrictions?.canEditProfile ?? setup.status !== "Paused";
        const canPublish = restrictions?.canPublish ?? false;
        const unreadCount = notificationsData?.unreadCount ?? stats?.unreadNotifications ?? 0;
        const orders = ordersData?.items.map(toSellerOrder) ?? dashboard?.recentOrders.map(toSellerOrder) ?? setup.orders;
        const lowStockItems = inventoryData?.items.filter(item => item.lowStock) ?? [];
        const tabTitle = workspaceTabs.find(tab => tab.id === activeTab)?.label ?? "Overview";
        const shopSlug = setup.slug ?? slugifyShopName(setup.shop);
        const currentPlan = getPlan(setup.plan?.toLowerCase() ?? "starter");
        const limit = currentPlan?.listingLimit ?? 5;
        const atLimit = limit !== -1 && setup.products.length >= limit;
        return (
            <section className="oi-view oi-container oi-seller-dashboard">
                <div className="oi-dashboard">
                    <aside className="oi-sidebar">
                        <div className="oi-sidebar__brand"><Logo size="sm" alt="Oilinga" /></div>
                        <small className="oi-sidebar__label">SELLER PORTAL</small>
                        <nav className="oi-sidebar__nav" aria-label="Seller workspace">
                            {workspaceTabs.map(tab => <button key={tab.id} type="button" className={`oi-sidebar__link${activeTab === tab.id ? " is-active" : ""}`} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}><Icon name={tab.icon} size={17} />{tab.label}{tab.id === "notifications" && unreadCount > 0 && <span className="oi-seller-nav__badge">{unreadCount}</span>}</button>)}
                        </nav>
                        <div className="oi-sidebar__profile"><span className="oi-avatar">{setup.owner.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="oi-sidebar__profile-text"><b className="oi-sidebar__profile-name">{setup.shop}</b><small className="oi-sidebar__profile-meta">Seller account</small></div></div>
                    </aside>
                    <div className="oi-dashboard__content oi-seller-dashboard__content">
                        <div className="oi-seller-dashboard__heading">
                            <div>
                                <span className="oi-eyebrow oi-eyebrow--green">SELLER DASHBOARD</span>
                                <h1>{setup.shop} <span className={`oi-seller-verify ${setup.verified ? "is-verified" : ""}`}><Icon name={setup.verified ? "shield" : "lock"} size={13} />{setup.verified ? "Verified" : "Unverified"}</span></h1>
                                <p>{setup.location}{setup.tagline ? ` · ${setup.tagline}` : ""}</p>
                            </div>
                            <Link className="oi-seller-dashboard__live" href={`/shops/${shopSlug}`}><span /> View storefront</Link>
                        </div>
                        {(restrictions?.reasons.length || shopProfile && !shopProfile.verification.verified) && (
                            <div className={`oi-seller-alert ${restrictions?.reasons.length ? "oi-seller-alert--danger" : "oi-seller-alert--warning"}`}>
                                <Icon name={restrictions?.reasons.length ? "lock" : "shield"} size={18} />
                                <div>
                                    <strong>{restrictions?.reasons.length ? "Limited shop access" : "Verification required"}</strong>
                                    <span>{restrictions?.reasons.length
                                        ? restrictions.reasons.join(" ")
                                        : "Your shop is visible to buyers, but verification is needed before you can publish new products."}</span>
                                </div>
                                {shopProfile?.verification.canRequest && (
                                    <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={saving} onClick={() => void requestVerification()}>{saving ? "Sending…" : "Request verification"}</button>
                                )}
                            </div>
                        )}
                        {workspaceLoading && <div className="oi-seller-refresh"><span className="oi-seller-refresh__dot" /> Refreshing your workspace…</div>}
                        {error && <p role="alert" className="oi-seller-setup__error">{error}</p>}
                        <div className="oi-seller-dashboard__workspace">
                            <div className="oi-seller-dashboard__workspace-head">
                                <div><span className="oi-eyebrow oi-eyebrow--green">SHOP WORKSPACE</span><h2>{tabTitle}</h2></div>
                                {activeTab === "products" && !atLimit && <button className="oi-btn oi-btn--primary" type="button" disabled={saving} onClick={() => setProductFormOpen(!productFormOpen)}>{productFormOpen ? "Close form" : "Add product"}</button>}
                            </div>

                            {atLimit && activeTab !== "subscription" && (
                                <div className="oi-seller-upgrade-banner">
                                    <Icon name="sparkle" size={18} />
                                    <div><strong>You've reached your {limit}-product limit on the {currentPlan?.name} plan.</strong><span>Upgrade to list more products and reduce your commission rate.</span></div>
                                    <Link href="/seller/pricing" className="oi-btn oi-btn--gold oi-btn--sm">Upgrade plan</Link>
                                </div>
                            )}

                            {activeTab === "overview" && <>
                                <div className="oi-seller-metric-grid">
                                    <article className="oi-seller-metric oi-seller-metric--primary"><span>Gross sales</span><strong>{formatMoney(stats?.grossSales ?? delivered)}</strong><small>Processing, shipped & delivered orders</small></article>
                                    <article className="oi-seller-metric"><span>Net earnings</span><strong>{formatMoney(stats?.netEarnings ?? 0)}</strong><small>After {((stats?.commissionRate ?? 0) * 100).toFixed(1)}% commission</small></article>
                                    <article className="oi-seller-metric"><span>Available balance</span><strong>{formatMoney(stats?.availableBalance ?? 0)}</strong><small>{formatMoney(stats?.paidOut ?? 0)} paid out</small></article>
                                    <article className="oi-seller-metric"><span>Orders</span><strong>{stats?.totalOrders ?? setup.orders.length}</strong><small>{stats?.pendingOrders ?? 0} new · {pending > 0 ? formatMoney(pending) : "₦0"} pending</small></article>
                                </div>
                                <div className="oi-seller-insight-grid">
                                    <article className="oi-seller-panel">
                                        <div className="oi-seller-panel__head"><div><span className="oi-eyebrow oi-eyebrow--green">SALES PULSE</span><h3>Last 7 days</h3></div><button type="button" className="oi-seller-dashboard__text-button" onClick={() => setActiveTab("analytics")}>View analytics →</button></div>
                                        {analytics?.series.some(point => point.revenue > 0) ? <SalesBars series={analytics.series.slice(-7)} compact /> : <p className="oi-seller-dashboard__hint">No sales recorded in this period yet.</p>}
                                        <div className="oi-seller-panel__foot"><span>{formatMoney(analytics?.summary.revenue ?? 0)}Revenue ({analytics?.range.days ?? 30}d)</span><span>{analytics?.summary.orders ?? 0} orders</span></div>
                                    </article>
                                    <article className="oi-seller-panel">
                                        <div className="oi-seller-panel__head"><div><span className="oi-eyebrow oi-eyebrow--green">STOCK WATCH</span><h3>Needs attention</h3></div><button type="button" className="oi-seller-dashboard__text-button" onClick={() => setActiveTab("inventory")}>Manage inventory →</button></div>
                                        {lowStockItems.length || dashboard?.lowStockProducts.length ? (
                                            <ul className="oi-seller-stock-alerts">{(lowStockItems.length ? lowStockItems.map(item => ({ id: item.id, name: item.name, stock: item.stock })) : dashboard?.lowStockProducts ?? []).slice(0, 4).map(item => (
                                                <li key={item.id}><span>{item.name}</span><b>{item.stock} left</b></li>
                                            ))}</ul>
                                        ) : <p className="oi-seller-dashboard__hint">All products have healthy stock levels.</p>}
                                        <div className="oi-seller-panel__foot"><span>{stats?.totalProducts ?? setup.products.length} products</span><span>{inventory} units in stock</span></div>
                                    </article>
                                </div>
                                <div className="oi-seller-dashboard__section-head"><h3>Recent orders</h3><button type="button" className="oi-seller-dashboard__text-button" onClick={() => setActiveTab("orders")}>All orders →</button></div>
                                {orders.length ? (
                                    <div className="oi-seller-table-wrap"><table className="oi-seller-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="oi-seller-table__right">Amount</th></tr></thead><tbody>{orders.slice(0, 5).map(order => (
                                        <tr key={order.id}><td><b>{order.orderNumber ?? order.id}</b></td><td>{order.customer}</td><td>{shortDate(order.createdAt)}</td><td><Badge tone={SELLER_STATUS_TONE[order.status] ?? "neutral"}>{order.status}</Badge></td><td className="oi-seller-table__right"><b>{formatMoney(order.total)}</b></td></tr>
                                    ))}</tbody></table></div>
                                ) : <div className="oi-seller-dashboard__empty-state"><Icon name="receipt" size={24} /><h3>No orders yet</h3><p>Orders placed for your products will appear here.</p></div>}
                            </>}
                            {activeTab === "analytics" && <>
                                <div className="oi-seller-toolbar">
                                    <div><span className="oi-eyebrow oi-eyebrow--green">SALES ANALYTICS</span><h3 className="oi-seller-toolbar__title">{analytics?.range.days ?? analyticsDays}-day performance</h3></div>
                                    <div className="oi-seller-segmented" role="group" aria-label="Analytics range">{[7, 14, 30, 90].map(days => <button key={days} type="button" className={analyticsDays === days ? "is-active" : ""} onClick={() => { setAnalyticsDays(days); void loadAnalyticsPanel(days); }}>{days}d</button>)}</div>
                                </div>
                                <div className="oi-seller-metric-grid">
                                    <article className="oi-seller-metric oi-seller-metric--primary"><span>Revenue</span><strong>{formatMoney(analytics?.summary.revenue ?? 0)}</strong><small>Seller line totals in range</small></article>
                                    <article className="oi-seller-metric"><span>Orders</span><strong>{analytics?.summary.orders ?? 0}</strong><small>Processing, shipped & delivered</small></article>
                                    <article className="oi-seller-metric"><span>Average order</span><strong>{formatMoney(analytics?.summary.averageOrderValue ?? 0)}</strong><small>Revenue per order</small></article>
                                    <article className="oi-seller-metric"><span>Net earnings</span><strong>{formatMoney(analytics?.summary.earnings ?? 0)}</strong><small>After {((analytics?.summary.commissionRate ?? 0) * 100).toFixed(1)}% commission</small></article>
                                </div>
                                <article className="oi-seller-panel">
                                    <div className="oi-seller-panel__head"><div><h3>Revenue by day</h3><p>{analytics?.range.from ?? "—"} to {analytics?.range.to ?? "—"}</p></div></div>
                                    {analytics?.series.some(point => point.revenue > 0) ? <SalesBars series={analytics.series} /> : <p className="oi-seller-dashboard__hint">No completed sales in this range yet.</p>}
                                </article>
                                <div className="oi-seller-dashboard__section-head"><h3>Product performance</h3><span className="oi-seller-dashboard__hint">{performance?.summary.totalUnitsSold ?? 0} units sold · {formatMoney(performance?.summary.totalRevenue ?? 0)} revenue</span></div>
                                {performance?.items.length ? (
                                    <div className="oi-seller-table-wrap"><table className="oi-seller-table"><thead><tr><th>Product</th><th>Status</th><th className="oi-seller-table__right">Units sold</th><th className="oi-seller-table__right">Orders</th><th className="oi-seller-table__right">Revenue</th></tr></thead><tbody>{performance.items.slice(0, 10).map(item => (
                                        <tr key={item.id}><td><b>{item.name}</b><small>{item.category ?? "Uncategorised"}</small></td><td><span className={`oi-seller-dashboard__status ${item.status === "ACTIVE" ? "" : "oi-seller-dashboard__status--draft"}`}>{displayListingStatus(item.status)}</span></td><td className="oi-seller-table__right">{item.unitsSold}</td><td className="oi-seller-table__right">{item.orderCount}</td><td className="oi-seller-table__right"><b>{formatMoney(item.revenue)}</b></td></tr>
                                    ))}</tbody></table></div>
                                ) : <p className="oi-seller-dashboard__hint">Product performance will appear once sales are recorded.</p>}
                            </>}
                            {activeTab === "products" && <>
                                {productFormOpen && !atLimit && <form className="oi-seller-dashboard__add-form" onSubmit={async event => { if (await addProduct(event)) setProductFormOpen(false); }}><label className="oi-seller-setup__field">Product name<input required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} /></label><label className="oi-seller-setup__field">Category<select required value={product.category} onChange={e => setProduct({ ...product, category: e.target.value as ProductCategory })}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="oi-seller-setup__field">Product description<textarea required value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} rows={3} /></label><label className="oi-seller-setup__field">Price (₦)<input required type="number" min="1" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></label><label className="oi-seller-setup__field">Pack size<input required value={product.size} onChange={e => setProduct({ ...product, size: e.target.value })} /></label><label className="oi-seller-setup__field">Stock<input required type="number" min="0" value={product.stock} onChange={e => setProduct({ ...product, stock: e.target.value })} /></label><ProductImageFields value={product} onChange={patch => setProduct(current => ({ ...current, ...patch }))} /><button className="oi-btn oi-btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save product"}</button>{error && <p role="alert" className="oi-seller-setup__error">{error}</p>}</form>}
                                <div className="oi-seller-dashboard__product-list">{setup.products.length ? setup.products.map(productRow) : <p className="oi-seller-dashboard__empty">No products yet. Add your first product to start building your catalogue.</p>}</div>
                            </>}
                            {activeTab === "inventory" && <>
                                <div className="oi-seller-toolbar">
                                    <div><span className="oi-eyebrow oi-eyebrow--green">INVENTORY OVERVIEW</span><h3 className="oi-seller-toolbar__title">Live stock levels</h3></div>
                                    <div className="oi-seller-toolbar__controls">
                                        <input className="oi-input" type="search" placeholder="Search products" value={inventorySearch} onChange={event => { const search = event.target.value; setInventorySearch(search); setInventoryPage(1); void loadInventoryPanel(1, search, lowStockOnly); }} />
                                        <label className="oi-seller-check"><input type="checkbox" checked={lowStockOnly} onChange={event => { const onlyLow = event.target.checked; setLowStockOnly(onlyLow); setInventoryPage(1); void loadInventoryPanel(1, inventorySearch, onlyLow); }} /> Low stock only</label>
                                    </div>
                                </div>
                                <div className="oi-seller-metric-grid oi-seller-metric-grid--compact">
                                    <article className="oi-seller-metric"><span>Products</span><strong>{inventoryData?.summary.totalProducts ?? setup.products.length}</strong><small>{stats?.activeProducts ?? 0} active</small></article>
                                    <article className="oi-seller-metric"><span>Units in stock</span><strong>{inventoryData?.summary.totalUnits ?? inventory}</strong><small>Across all listings</small></article>
                                    <article className="oi-seller-metric"><span>Low stock</span><strong>{inventoryData?.summary.lowStockProducts ?? dashboard?.stats.lowStockProducts ?? 0}</strong><small>1–5 units remaining</small></article>
                                    <article className="oi-seller-metric"><span>Stock value</span><strong>{formatMoney(inventoryData?.summary.totalStockValue ?? 0)}</strong><small>At current prices</small></article>
                                </div>
                                {!canManageInventory && <p className="oi-seller-alert oi-seller-alert--warning">Your shop has restricted access. Stock levels are read-only until access is restored.</p>}
                                <div className="oi-seller-table-wrap"><table className="oi-seller-table"><thead><tr><th>Product</th><th>Category</th><th>Status</th><th className="oi-seller-table__right">Stock</th><th className="oi-seller-table__right">Stock value</th></tr></thead><tbody>{(inventoryData?.items ?? []).map(item => (
                                    <tr key={item.id}>
                                        <td><b>{item.name}</b><small>{item.sku ?? item.slug}</small></td>
                                        <td>{item.category ?? "Uncategorised"}</td>
                                        <td><span className={`oi-seller-dashboard__status ${item.status === "ACTIVE" ? "" : "oi-seller-dashboard__status--draft"}`}>{displayListingStatus(item.status)}</span>{item.lowStock && <span className="oi-seller-flag">Low</span>}</td>
                                        <td className="oi-seller-table__right"><StockControl productId={item.id} stock={item.stock} busy={stockBusy === item.id} disabled={!canManageInventory} onSave={(id, next) => { void updateStock(id, next); }} /></td>
                                        <td className="oi-seller-table__right"><b>{formatMoney(item.stockValue)}</b></td>
                                    </tr>
                                ))}</tbody></table></div>
                                {!inventoryData?.items.length && <p className="oi-seller-dashboard__hint">No products match this view.</p>}
                                {inventoryData && <Pager pagination={inventoryData.pagination} onPage={page => { setInventoryPage(page); void loadInventoryPanel(page, inventorySearch, lowStockOnly); }} />}
                            </>}
                            {activeTab === "orders" && <>
                                <div className="oi-seller-toolbar">
                                    <div><span className="oi-eyebrow oi-eyebrow--green">ORDER MANAGEMENT</span><h3 className="oi-seller-toolbar__title">Your shop's orders</h3></div>
                                    <div className="oi-seller-toolbar__controls">
                                        <input className="oi-input" type="search" placeholder="Order number or customer" value={orderSearch} onChange={event => { const search = event.target.value; setOrderSearch(search); setOrderPage(1); void loadOrdersPanel(1, orderStatus, search); }} />
                                        <select aria-label="Filter orders by status" value={orderStatus} onChange={event => { const status = event.target.value; setOrderStatus(status); setOrderPage(1); void loadOrdersPanel(1, status, orderSearch); }}>
                                            <option value="ALL">All statuses</option>
                                            {(["New", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"] as SellerOrderStatus[]).map(status => <option key={status} value={status}>{status}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {!canManageOrders && <p className="oi-seller-alert oi-seller-alert--warning">Your shop has restricted access. Orders are read-only until access is restored.</p>}
                                <div className="oi-seller-dashboard__orders">
                                    {orders.length ? orders.map(order => {
                                        const nextStatuses = SELLER_TRANSITIONS[order.status] ?? [];
                                        const busy = orderBusy === order.id;
                                        return (
                                            <article key={order.id}>
                                                <div className="oi-seller-order__info">
                                                    <div className="oi-seller-order__head"><b>Order {order.orderNumber ?? order.id}</b><Badge tone={SELLER_STATUS_TONE[order.status] ?? "neutral"}>{order.status}</Badge></div>
                                                    <span>{order.customer}{order.customerEmail ? ` · ${order.customerEmail}` : ""} · {shortDate(order.createdAt)}</span>
                                                    <small>{order.items.map(item => `${item.quantity} × ${item.name}`).join(", ")}</small>
                                                    <small>{order.itemCount ?? order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {order.paymentStatus === "SUCCESS" ? "Payment confirmed" : order.paymentStatus === "REFUNDED" ? "Refunded" : "Awaiting payment"}</small>
                                                </div>
                                                <div className="oi-seller-order__money">
                                                    <strong>{formatMoney(order.total)}</strong>
                                                    <small>Seller items</small>
                                                </div>
                                                <div className="oi-seller-order__controls">
                                                    <select
                                                        aria-label={`Status for order ${order.id}`}
                                                        value={order.status}
                                                        disabled={busy || !canManageOrders || nextStatuses.length === 0}
                                                        onChange={event => void updateOrderStatus(order.dbId ?? order.id, event.target.value as SellerOrderStatus)}
                                                    >
                                                        <option value={order.status}>{order.status}</option>
                                                        {nextStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                                                    </select>
                                                    {["New", "Processing"].includes(order.status) && (
                                                        <button type="button" className="oi-seller-order__cancel" disabled={busy || !canManageOrders} onClick={() => void cancelSellerOrder(order.dbId ?? order.id)}>
                                                            {busy ? "Working…" : "Cancel order"}
                                                        </button>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    }) : (
                                        <div className="oi-seller-dashboard__empty-state"><Icon name="receipt" size={24} /><h3>No orders found</h3><p>Orders placed for your products will appear here.</p></div>
                                    )}
                                </div>
                                {ordersData && <Pager pagination={ordersData.pagination} onPage={page => { setOrderPage(page); void loadOrdersPanel(page, orderStatus, orderSearch); }} />}
                            </>}
                            {activeTab === "earnings" && <>
                                <div className="oi-seller-toolbar">
                                    <div><span className="oi-eyebrow oi-eyebrow--green">EARNINGS</span><h3 className="oi-seller-toolbar__title">Revenue & transactions</h3></div>
                                </div>
                                <div className="oi-seller-metric-grid">
                                    <article className="oi-seller-metric oi-seller-metric--primary"><span>Gross sales</span><strong>{formatMoney(earningsData?.summary.grossSales ?? 0)}</strong><small>{earningsData?.summary.totalOrders ?? 0} qualifying orders</small></article>
                                    <article className="oi-seller-metric"><span>Commission</span><strong>−{formatMoney(earningsData?.summary.commission ?? 0)}</strong><small>{((earningsData?.summary.commissionRate ?? 0) * 100).toFixed(1)}% platform rate</small></article>
                                    <article className="oi-seller-metric"><span>Net earnings</span><strong>{formatMoney(earningsData?.summary.netEarnings ?? 0)}</strong><small>After commission</small></article>
                                    <article className="oi-seller-metric"><span>Available balance</span><strong>{formatMoney(earningsData?.summary.availableBalance ?? 0)}</strong><small>{formatMoney(earningsData?.summary.paidOut ?? 0)} paid out to date</small></article>
                                </div>
                                <div className="oi-seller-dashboard__section-head"><h3>Transaction history</h3><span className="oi-seller-dashboard__hint">Refunds and payouts appear as negative amounts.</span></div>
                                {earningsData?.items.length ? (
                                    <div className="oi-seller-table-wrap"><table className="oi-seller-table"><thead><tr><th>Transaction</th><th>Type</th><th>Date</th><th>Status</th><th className="oi-seller-table__right">Gross</th><th className="oi-seller-table__right">Fee</th><th className="oi-seller-table__right">Net</th></tr></thead><tbody>{earningsData.items.map(item => (
                                        <tr key={item.id}>
                                            <td><b>{item.title}</b><small>{item.reference ?? item.orderNumber ?? "—"}</small></td>
                                            <td><span className={`oi-seller-type oi-seller-type--${item.type}`}>{item.type}</span></td>
                                            <td>{shortDate(item.date)}</td>
                                            <td>{item.status}</td>
                                            <td className="oi-seller-table__right">{formatMoney(item.gross)}</td>
                                            <td className="oi-seller-table__right">{formatMoney(item.commission)}</td>
                                            <td className="oi-seller-table__right"><b>{formatMoney(item.net)}</b></td>
                                        </tr>
                                    ))}</tbody></table></div>
                                ) : <div className="oi-seller-dashboard__empty-state"><Icon name="wallet" size={24} /><h3>No transactions yet</h3><p>Completed sales and payouts will appear here.</p></div>}
                                {earningsData && <Pager pagination={earningsData.pagination} onPage={page => { setTransactionPage(page); void loadEarningsPanel(page); }} />}
                                <p className="oi-seller-dashboard__hint">Figures come from your shop's own order lines and recorded settlements. <Link href="/seller/pricing" className="oi-link">Review commission plans</Link>.</p>
                            </>}
                            {activeTab === "notifications" && <>
                                <div className="oi-seller-toolbar">
                                    <div><span className="oi-eyebrow oi-eyebrow--green">NOTIFICATION CENTRE</span><h3 className="oi-seller-toolbar__title">{unreadCount} unread</h3></div>
                                    <div className="oi-seller-toolbar__controls">
                                        <label className="oi-seller-check"><input type="checkbox" checked={unreadOnly} onChange={event => { const next = event.target.checked; setUnreadOnly(next); setNotificationPage(1); void loadNotificationsPanel(1, next); }} /> Unread only</label>
                                        <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={!unreadCount} onClick={() => void readAllNotifications()}>Mark all as read</button>
                                    </div>
                                </div>
                                <div className="oi-seller-notifications">
                                    {notificationsData?.items.length ? notificationsData.items.map(item => (
                                        <article key={item.id} className={`oi-seller-notification${item.read ? "" : " is-unread"}`}>
                                            <div className="oi-seller-notification__icon"><Icon name={notificationIcon(item.type)} size={18} /></div>
                                            <div className="oi-seller-notification__body">
                                                <div className="oi-seller-notification__head"><b>{item.title}</b><span>{shortDate(item.createdAt)}</span></div>
                                                <p>{item.message}</p>
                                            </div>
                                            {!item.read && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => void readNotification(item.id)}>Mark read</button>}
                                        </article>
                                    )) : <div className="oi-seller-dashboard__empty-state"><Icon name="bell" size={24} /><h3>All caught up</h3><p>Order updates, verification news and stock alerts will appear here.</p></div>}
                                </div>
                                {notificationsData && <Pager pagination={notificationsData.pagination} onPage={page => { setNotificationPage(page); void loadNotificationsPanel(page); }} />}
                            </>}
                            {activeTab === "subscription" && (
                                <div className="oi-seller-dashboard__plan">
                                    <div className="oi-seller-upgrade-banner oi-seller-upgrade-banner--neutral">
                                        <Icon name="sparkle" size={18} />
                                        <div>
                                            <strong>You are on the {currentPlan?.name ?? "Starter"} plan</strong>
                                            <span>{currentPlan?.commission ?? 4}% commission · {limit === -1 ? "Unlimited" : limit} product{limit !== 1 ? "s" : ""}</span>
                                        </div>
                                        <Link href="/seller/subscription" className="oi-btn oi-btn--outline oi-btn--sm">Manage subscription</Link>
                                    </div>
                                    <p className="oi-seller-dashboard__hint" style={{ marginTop: "var(--space-5)" }}>
                                        View billing history, upgrade your plan or change your billing cycle from the{" "}
                                        <Link href="/seller/subscription" className="oi-link">subscription management page</Link>.
                                    </p>
                                    <Link href="/seller/pricing" className="oi-btn oi-btn--primary" style={{ marginTop: "var(--space-4)", display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                                        View all plans <Icon name="arrow-right" size={15} />
                                    </Link>
                                </div>
                            )}
                            {activeTab === "settings" && (
                                <div className="oi-seller-dashboard__settings">
                                    <label className="oi-seller-setup__field">Shop name<input value={settingsDraft.shop} onChange={event => setSettingsDraft({ ...settingsDraft, shop: event.target.value })} /></label>
                                    <label className="oi-seller-setup__field">Owner<input value={settingsDraft.owner} onChange={event => setSettingsDraft({ ...settingsDraft, owner: event.target.value })} /></label>
                                    <label className="oi-seller-setup__field">Location<input value={settingsDraft.location} onChange={event => setSettingsDraft({ ...settingsDraft, location: event.target.value })} /></label>
                                    <label className="oi-seller-setup__field">Shop introduction<input value={settingsDraft.tagline} onChange={event => setSettingsDraft({ ...settingsDraft, tagline: event.target.value })} /></label>
                                    <label className="oi-seller-setup__field">Shop description<textarea rows={3} value={settingsDraft.description} onChange={event => setSettingsDraft({ ...settingsDraft, description: event.target.value })} /></label>
                                    <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={saving || !canEditProfile} onClick={() => void updateShop()}>{saving ? "Saving…" : "Save shop profile"}</button>
                                    {!canEditProfile && <p className="oi-seller-dashboard__hint">Profile editing is unavailable while your shop is restricted.</p>}

                                    <div className="oi-seller-dashboard__visibility">
                                        <div>
                                            <h3>Verification & visibility</h3>
                                            <p>
                                                <b>{shopProfile?.verification.verified ?? setup.verified ? "Verified" : shopProfile?.verification.requestedAt ?? setup.verificationRequestedAt ? "Verification requested" : "Not verified"}</b>
                                                {" · "}
                                                <b>{setup.published ? "Published" : "Unpublished"}</b>
                                            </p>
                                            <small>{(shopProfile?.verification.verified ?? setup.verified)
                                                ? restrictions?.shopStatus === "SUSPENDED" || setup.status === "Paused"
                                                    ? "Your shop is suspended. Contact an administrator before publishing."
                                                    : "Publishing makes your shop and eligible products visible in the marketplace."
                                                : "Admin verification is required before your shop can be published."}</small>
                                        </div>
                                        <div className="oi-seller-dashboard__visibility-actions">
                                            {(shopProfile?.verification.canRequest ?? !setup.verified) && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={saving} onClick={() => void requestVerification()}>{saving ? "Sending…" : "Request verification"}</button>}
                                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={saving || (!setup.published && !canPublish)} onClick={() => void setPublication(!setup.published)}>{setup.published ? "Unpublish shop" : "Publish shop"}</button>
                                        </div>
                                    </div>

                                    {/* Danger zone */}
                                    <div className="oi-sub-danger-zone" style={{ marginTop: "var(--space-10)" }}>
                                        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-base)", fontWeight: "var(--weight-bold)", color: "var(--color-danger)" }}>Danger zone</h3>
                                        {!showDeleteShop ? (
                                            <div className="oi-sub-danger-card">
                                                <div>
                                                    <strong>Delete your shop</strong>
                                                    <p>Permanently remove your shop and all product listings from Oilinga. This cannot be undone.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="oi-btn oi-btn--danger"
                                                    onClick={() => { setShowDeleteShop(true); setDeleteConfirmText(""); }}
                                                >
                                                    Delete shop
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="oi-sub-danger-card oi-sub-danger-card--confirming">
                                                <p>Type <strong>DELETE</strong> to confirm you want to permanently delete <strong>{setup.shop}</strong>.</p>
                                                <input
                                                    className="oi-input"
                                                    type="text"
                                                    value={deleteConfirmText}
                                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                                    placeholder="DELETE"
                                                    autoComplete="off"
                                                />
                                                {error && <p role="alert" className="oi-seller-setup__error">{error}</p>}
                                                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                                                    <button
                                                        type="button"
                                                        className="oi-btn oi-btn--danger"
                                                        disabled={deleteConfirmText !== "DELETE" || deleting}
                                                        onClick={deleteShop}
                                                    >
                                                        {deleting ? "Deleting…" : "Yes, delete my shop permanently"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="oi-btn oi-btn--outline"
                                                        onClick={() => { setShowDeleteShop(false); setDeleteConfirmText(""); setError(""); }}
                                                        disabled={deleting}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="oi-seller-dashboard__footer"><p>Your shop is published and ready for buyers.</p><div className="oi-seller-dashboard__footer-actions"><Link className="oi-btn oi-btn--outline" href={`/shops/${shopSlug}`}>View storefront <Icon name="arrow-right" size={16} /></Link><Link className="oi-btn oi-btn--outline" href="/marketplace">Go to marketplace <Icon name="arrow-right" size={16} /></Link></div></div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return <section className="oi-view oi-container"><p>Shop setup could not be loaded. Return to the <Link className="oi-link" href="/seller">seller overview</Link> and try again.</p></section>;
}
