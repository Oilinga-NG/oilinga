"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { CustomerOrder, OrderStatusKey, PaymentRecord, PaymentRefundRecord, ReconciliationReport } from "@/lib/types";
import { ORDER_TRANSITIONS } from "@/lib/types";
import { cn } from "@/lib/cn";
import { mapOrder } from "@/lib/backend-mappers";
import { readBackendData, mutateBackendData } from "@/lib/backend-client";
import type { DatabaseShop } from "@/lib/marketplace-contracts";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";
import { useMarketplaceData } from "@/components/providers/MarketplaceDataProvider";
import type { Category } from "@/lib/data";
import type { Plan, PlanFeature } from "@/lib/subscription";

type ModerationStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";
type VerificationStatus = "UNREQUESTED" | "PENDING" | "APPROVED" | "REJECTED";
type ReviewStatus = "VISIBLE" | "PENDING" | "HIDDEN";
type SubscriptionStatus = "Active" | "Paused" | "Cancelled";
type AdminProduct = {
    id?: string;
    dbId?: string;
    name: string;
    price: string;
    size: string;
    stock: string;
    status?: "Active" | "Draft" | "Out of stock";
    moderationStatus?: ModerationStatus;
    moderationNote?: string | null;
    category?: string;
    description?: string;
    imageUrl?: string | null;
};
type AdminShop = Omit<DatabaseShop, "name" | "status" | "products"> & {
    name: string;
    shop: string;
    status?: "Active" | "Paused";
    shopStatus?: "Active" | "Paused";
    verificationStatus?: VerificationStatus;
    verificationNote?: string | null;
    verifiedAt?: string | null;
    verificationRequestedAt?: string | null;
    products: AdminProduct[];
};
type Tab = "overview" | "users" | "sellers" | "products" | "orders" | "payments" | "finance" | "subscriptions" | "reviews" | "settings" | "audit" | "permissions";
type AdminRole = "CUSTOMER" | "SELLER" | "ADMIN";
type AdminUser = {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    emailVerifiedAt: string | null;
    createdAt: string;
};
type PaymentState = Record<string, "Pending" | "Confirmed" | "Failed" | "Refunded">;
type Settlement = { id: string; amount: number; date: string; status: "Confirmed" | "Recorded" | string };
type PayoutStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
type PayoutEvent = { id: string; fromStatus: PayoutStatus | null; toStatus: PayoutStatus; actorName: string | null; actorRole: string | null; note: string | null; reference: string | null; createdAt: string };
type Payout = {
    id: string; sellerId: string; sellerName: string | null; shopId: string; shopName: string | null;
    amount: number; currency: string; status: PayoutStatus; reference: string; note: string | null;
    requestedAt: string; reviewedAt: string | null; reviewerName: string | null; reviewNote: string | null;
    paidAt: string | null; failureReason: string | null; events?: PayoutEvent[];
};
type SettlementRecord = {
    id: string; sellerId: string; shopId: string | null; amount: number; currency: string;
    status: string; kind: "SALE" | "SUBSCRIPTION" | "ADJUSTMENT"; reference: string | null;
    payoutId: string | null; createdAt: string;
};
type FinanceReport = {
    currency: string; commissionRate: number; range: { from: string | null; to: string | null };
    totals: { grossSales: number; totalRefunds: number; commission: number; netEarnings: number; paidOut: number; pendingPayouts: number; availableBalance: number; totalOrders: number };
    reconciliation: { available: boolean; checked: number; matched: number; mismatches: number; message?: string; totals: { localSuccessfulKobo: number; gatewaySuccessfulKobo: number; successfulCount: number } };
    bySeller: { sellerId: string; sellerName: string; shops: string; grossSales: number; totalRefunds: number; commission: number; netEarnings: number; paidOut: number; pendingPayouts: number; availableBalance: number; totalOrders: number }[];
};
type AdminPermissions = {
    canManageFinance: boolean;
    canManageUsers: boolean;
    canModerate: boolean;
    canViewAudit: boolean;
};
type PermissionKey = keyof AdminPermissions;
type PlatformDashboard = {
    users: { total: number; customers: number; sellers: number; admins: number; active: number; suspended: number };
    shops: { total: number; verified: number; pendingVerification: number; rejected: number; published: number; suspended: number };
    products: { total: number; active: number; outOfStock: number; awaitingReview: number; rejected: number };
    orders: { total: number; pending: number; processing: number; shipped: number; delivered: number; cancelled: number; refunded: number; grossValue: number };
    payments: { total: number; successful: number; failed: number; refunded: number; successfulVolume: number };
    finance: { commissionRate: number; settlements: number; settledAmount: number; pendingPayouts: number; payoutAmount: number };
    reviews: { total: number; visible: number; pending: number; hidden: number; averageRating: number };
    recentAudit: { id: string; action: string; actorName: string; summary: string; createdAt: string }[];
};
type PlatformSettings = { commissionRate: number; reviewModeration: boolean };
type AdminReview = {
    id: string;
    authorName: string;
    targetType: string;
    targetName: string;
    targetSlug: string;
    rating: number;
    text: string;
    status: ReviewStatus;
    moderationNote: string | null;
    createdAt: string;
};
type PendingShop = {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    published: boolean;
    status: string;
    verificationStatus: VerificationStatus;
    verificationNote: string | null;
    verificationRequestedAt: string | null;
    owner?: { id: string; name: string; email: string } | null;
};
type ModerationProduct = {
    id: string;
    name: string;
    slug: string;
    status: string;
    moderationStatus: ModerationStatus;
    moderationNote: string | null;
    price: string | number;
    shop?: { id: string; name: string; slug: string } | null;
};
type AuditItem = {
    id: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string | null;
    summary: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
};
type Paginated<T> = { items: T[]; pagination: { page: number; limit: number; total: number; pages: number } };
type UserPermissionView = { userId: string; role: string; permissions: AdminPermissions };
type AdminPlan = Plan & {
    active: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
};
type AdminPlanDraft = {
    id: string;
    name: string;
    tagline: string;
    monthlyPrice: string;
    annualPrice: string;
    commission: string;
    listingLimit: string;
    sortOrder: string;
    features: string;
    featured: boolean;
    active: boolean;
};
type BillingCycle = "monthly" | "annual";
type AdminSubscription = {
    id: string;
    shopId: string;
    shopName: string;
    shopSlug: string;
    owner: { id: string; name: string; email: string; role: string; status: string } | null;
    plan: string;
    planName: string;
    subscriptionStatus: SubscriptionStatus;
    billingCycle: BillingCycle | null;
    nextBillingDate: string | null;
    updatedAt: string;
};
type SubscriptionUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    shops: { id: string; name: string; slug: string; plan: string; subscriptionStatus: string }[];
};
type SubscriptionDraft = {
    userId: string;
    shopId: string;
    plan: string;
    subscriptionStatus: SubscriptionStatus;
    billingCycle: BillingCycle;
    nextBillingDate: string;
};
const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "users", label: "Users & roles", icon: "shield" },
    { id: "sellers", label: "Seller verification", icon: "store" },
    { id: "products", label: "Shops & products", icon: "box" },
    { id: "orders", label: "Orders", icon: "receipt" },
    { id: "payments", label: "Payments", icon: "lock" },
    { id: "finance", label: "Commission & settlements", icon: "wallet" },
    { id: "reviews", label: "Review moderation", icon: "star" },
    { id: "settings", label: "Platform settings", icon: "settings" },
    { id: "audit", label: "Audit log", icon: "archive" },
    { id: "permissions", label: "Permissions", icon: "lock" },
    { id: "subscriptions", label: "Subscriptions", icon: "sparkle" },
];
const permissionLabels: { key: PermissionKey; label: string; detail: string }[] = [
    { key: "canManageFinance", label: "Financial actions", detail: "Commission, payment verification, payouts and settlements" },
    { key: "canManageUsers", label: "User administration", detail: "Accounts, roles, recovery, permissions and sessions" },
    { key: "canModerate", label: "Marketplace moderation", detail: "Shops, products, categories and reviews" },
    { key: "canViewAudit", label: "Audit history", detail: "Read the platform-wide administrative audit log" },
];

function money(value: number) { return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`; }

function formatSubscriptionDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : "—";
}

function planFeaturesToText(features: PlanFeature[]) {
    return features.map(feature => `${feature.included ? "+" : "-"} ${feature.text}`).join("\n");
}

function parsePlanFeatures(value: string): PlanFeature[] {
    return value.split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => ({
            text: line.replace(/^[+-]\s*/, "").trim(),
            included: !line.startsWith("-")
        }))
        .filter(feature => feature.text.length > 0);
}

function numericInput(value: string, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const emptyPlanDraft: AdminPlanDraft = {
    id: "",
    name: "",
    tagline: "",
    monthlyPrice: "0",
    annualPrice: "0",
    commission: "0",
    listingLimit: "0",
    sortOrder: "0",
    features: "",
    featured: false,
    active: true
};

const emptySubscriptionDraft: SubscriptionDraft = {
    userId: "",
    shopId: "",
    plan: "starter",
    subscriptionStatus: "Active",
    billingCycle: "monthly",
    nextBillingDate: ""
};

const ADMIN_STATUS_LABELS: Record<OrderStatusKey, string> = {
    PENDING: "New",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
};

export function AdminDashboard() {
    const { user, ready: authReady } = useAuth();
    const router = useRouter();
    const { refresh: refreshMarketplace } = useMarketplaceData();
    const [tab, setTab] = useState<Tab>("overview");
    const [shops, setShops] = useState<AdminShop[]>([]);
    const [selectedShopSlug, setSelectedShopSlug] = useState("");
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [payments, setPayments] = useState<PaymentState>({});
    const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
    const [refundRecords, setRefundRecords] = useState<PaymentRefundRecord[]>([]);
    const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
    const [reconcileBusy, setReconcileBusy] = useState(false);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [commissionRate, setCommissionRate] = useState("0");
    const [financeReport, setFinanceReport] = useState<FinanceReport | null>(null);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [payoutDetail, setPayoutDetail] = useState<Payout | null>(null);
    const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([]);
    const [financeBusy, setFinanceBusy] = useState("");
    const [adjustment, setAdjustment] = useState({ shopId: "", amount: "", reference: "" });
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryName, setCategoryName] = useState("");
    const [categoryCaption, setCategoryCaption] = useState("");
    const [categoryGlyph, setCategoryGlyph] = useState("");
    const [categoryError, setCategoryError] = useState("");
    const [editingCategoryId, setEditingCategoryId] = useState("");
    const [categoryDraft, setCategoryDraft] = useState({ name: "", caption: "", glyph: "🫙" });
    const [adminError, setAdminError] = useState("");
    const [adminNotice, setAdminNotice] = useState("");
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "CUSTOMER" as AdminRole, emailVerified: false });
    const [userError, setUserError] = useState("");
    const [userNotice, setUserNotice] = useState("");
    const [orderBusy, setOrderBusy] = useState("");
    const [ready, setReady] = useState(false);
    const [permissions, setPermissions] = useState<AdminPermissions>({ canManageFinance: false, canManageUsers: false, canModerate: false, canViewAudit: false });
    const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null);
    const [settings, setSettings] = useState<PlatformSettings | null>(null);
    const [pendingShops, setPendingShops] = useState<PendingShop[]>([]);
    const [moderationProducts, setModerationProducts] = useState<ModerationProduct[]>([]);
    const [reviews, setReviews] = useState<AdminReview[]>([]);
    const [reviewFilter, setReviewFilter] = useState<"ALL" | ReviewStatus>("PENDING");
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewPagination, setReviewPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
    const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
    const [auditSearchInput, setAuditSearchInput] = useState("");
    const [auditSearch, setAuditSearch] = useState("");
    const [auditPage, setAuditPage] = useState(1);
    const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
    const [userPermissions, setUserPermissions] = useState<Record<string, AdminPermissions>>({});
    const [shopNotes, setShopNotes] = useState<Record<string, string>>({});
    const [productNotes, setProductNotes] = useState<Record<string, string>>({});
    const [phase9Busy, setPhase9Busy] = useState("");
    const [subscriptionBusy, setSubscriptionBusy] = useState("");
    const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
    const [subscriptionPagination, setSubscriptionPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
    const [subscriptionSearchInput, setSubscriptionSearchInput] = useState("");
    const [subscriptionSearch, setSubscriptionSearch] = useState("");
    const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<"ALL" | SubscriptionStatus>("ALL");
    const [subscriptionPage, setSubscriptionPage] = useState(1);
    const [subscriptionUsers, setSubscriptionUsers] = useState<SubscriptionUser[]>([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState<Plan[]>([]);
    const [adminPlans, setAdminPlans] = useState<AdminPlan[]>([]);
    const [subscriptionDraft, setSubscriptionDraft] = useState<SubscriptionDraft>(emptySubscriptionDraft);
    const [editingSubscriptionId, setEditingSubscriptionId] = useState("");
    const [subscriptionFormError, setSubscriptionFormError] = useState("");
    const [planDraft, setPlanDraft] = useState<AdminPlanDraft>(emptyPlanDraft);
    const [editingPlanId, setEditingPlanId] = useState("");
    const [planFormError, setPlanFormError] = useState("");
    const [planBusy, setPlanBusy] = useState("");

    const loadAdminData = useCallback(async () => {
        const data = await readBackendData<{ shops: AdminShop[]; categories: Category[]; orders: CustomerOrder[]; payments: PaymentState; paymentRecords: PaymentRecord[]; refundRecords: PaymentRefundRecord[]; settlements: Settlement[]; settings: { commissionRate: number } }>("admin");
        const records = data.shops.map(record => ({ ...record, shop: record.name, shopStatus: (record.status === "Paused" ? "Paused" : "Active") as AdminShop["shopStatus"] }));
        setShops(records);
        setSelectedShopSlug(current => current && records.some(record => record.slug === current) ? current : records[0]?.slug ?? "");
        setCategories(data.categories ?? []);
        setOrders(data.orders);
        setPayments(data.payments);
        setPaymentRecords(data.paymentRecords ?? []);
        setRefundRecords(data.refundRecords ?? []);
        setSettlements(data.settlements ?? []);
        setCommissionRate(String((data.settings.commissionRate ?? 0) * 100));
    }, []);

    const loadDashboard = useCallback(async () => {
        setDashboard(await readBackendData<PlatformDashboard>("admin-dashboard"));
    }, []);

    const loadSettings = useCallback(async () => {
        const data = await readBackendData<PlatformSettings>("admin-settings");
        setSettings(data);
        setCommissionRate(String((data.commissionRate ?? 0) * 100));
    }, []);

    const loadPendingShops = useCallback(async () => {
        setPendingShops(await readBackendData<PendingShop[]>("admin-pending-shops"));
    }, []);

    const loadModerationProducts = useCallback(async () => {
        const data = await readBackendData<Paginated<ModerationProduct>>("admin-moderation-products", { limit: "100" });
        setModerationProducts(data.items);
    }, []);

    const loadReviews = useCallback(async () => {
        const params: Record<string, string> = { page: String(reviewPage), limit: "20" };
        if (reviewFilter !== "ALL") params.status = reviewFilter;
        const data = await readBackendData<Paginated<AdminReview>>("admin-reviews", params);
        setReviews(data.items);
        setReviewPagination(data.pagination);
    }, [reviewFilter, reviewPage]);

    const loadAuditLogs = useCallback(async () => {
        const params: Record<string, string> = { page: String(auditPage), limit: "20" };
        if (auditSearch) params.search = auditSearch;
        const data = await readBackendData<Paginated<AuditItem>>("admin-audit-logs", params);
        setAuditItems(data.items);
        setAuditPagination(data.pagination);
    }, [auditPage, auditSearch]);

    const loadUserPermissions = useCallback(async () => {
        const admins = users.filter(item => item.role === "ADMIN");
        const rows = await Promise.all(admins.map(item => readBackendData<UserPermissionView>("admin-user-permissions", { id: item.id })));
        setUserPermissions(Object.fromEntries(rows.map(row => [row.userId, row.permissions])));
    }, [users]);

    const loadSubscriptions = useCallback(async () => {
        const params: Record<string, string> = { page: String(subscriptionPage), limit: "20" };
        if (subscriptionSearch) params.search = subscriptionSearch;
        if (subscriptionStatusFilter !== "ALL") params.status = subscriptionStatusFilter;
        const data = await readBackendData<Paginated<AdminSubscription>>("admin-subscriptions", params);
        setSubscriptions(data.items);
        setSubscriptionPagination(data.pagination);
    }, [subscriptionPage, subscriptionSearch, subscriptionStatusFilter]);

    const loadSubscriptionUsers = useCallback(async () => {
        const data = await readBackendData<Paginated<SubscriptionUser>>("admin-subscription-users", { limit: "100" });
        setSubscriptionUsers(data.items);
    }, []);

    const loadSubscriptionPlans = useCallback(async () => {
        setSubscriptionPlans(await apiFetch<Plan[]>("/subscriptions/plans"));
    }, []);

    const loadAdminPlans = useCallback(async () => {
        setAdminPlans(await apiFetch<AdminPlan[]>("/admin/plans"));
    }, []);

    useEffect(() => {
        if (!authReady) return;
        if (!user) {
            router.replace(`/auth/login?next=${encodeURIComponent("/admin")}`);
            return;
        }
        if (user.role !== "admin") {
            router.replace(user.role === "seller" ? "/seller" : "/account");
            return;
        }
        let cancelled = false;
        void loadAdminData()
            .catch(error => { if (!cancelled) console.error("Admin data could not be loaded", error); })
            .finally(() => { if (!cancelled) setReady(true); });
        void loadDashboard().catch(error => { if (!cancelled) console.error("Platform statistics could not be loaded", error); });
        return () => { cancelled = true; };
    }, [authReady, user, router, loadAdminData, loadDashboard]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin") return;
        let cancelled = false;
        void readBackendData<AdminPermissions>("admin-permissions")
            .then(data => { if (!cancelled) setPermissions(data); })
            .catch(error => { if (!cancelled) setAdminError(error instanceof Error ? error.message : "Could not load administrator permissions."); });
        return () => { cancelled = true; };
    }, [authReady, user]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || !permissions.canManageUsers) return;
        let cancelled = false;
        void apiFetch<{ items: AdminUser[] }>("/admin/users?limit=100")
            .then(data => { if (!cancelled) setUsers(data.items); })
            .catch(error => { if (!cancelled) setUserError(error instanceof Error ? error.message : "Could not load users."); });
        return () => { cancelled = true; };
    }, [authReady, user, permissions.canManageUsers]);

    useEffect(() => {
        if (tab === "reviews" && !permissions.canModerate) setTab("overview");
        if (tab === "audit" && !permissions.canViewAudit) setTab("overview");
        if (tab === "permissions" && !permissions.canManageUsers) setTab("overview");
    }, [tab, permissions]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "settings") return;
        void loadSettings().catch(error => setAdminError(error instanceof Error ? error.message : "Could not load platform settings."));
    }, [authReady, user, tab, loadSettings]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || (tab !== "sellers" && tab !== "overview")) return;
        void loadPendingShops().catch(error => setAdminError(error instanceof Error ? error.message : "Could not load seller applications."));
    }, [authReady, user, tab, loadPendingShops]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "products" || !permissions.canModerate) return;
        void loadModerationProducts().catch(error => setAdminError(error instanceof Error ? error.message : "Could not load the product moderation queue."));
    }, [authReady, user, tab, permissions.canModerate, loadModerationProducts]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "reviews" || !permissions.canModerate) return;
        void loadReviews().catch(error => setAdminError(error instanceof Error ? error.message : "Could not load reviews."));
    }, [authReady, user, tab, permissions.canModerate, loadReviews]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "audit" || !permissions.canViewAudit) return;
        void loadAuditLogs().catch(error => setAdminError(error instanceof Error ? error.message : "Could not load the audit log."));
    }, [authReady, user, tab, permissions.canViewAudit, loadAuditLogs]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "permissions" || !permissions.canManageUsers || users.length === 0) return;
        void loadUserPermissions().catch(error => setAdminError(error instanceof Error ? error.message : "Could not load administrator permissions."));
    }, [authReady, user, tab, permissions.canManageUsers, users, loadUserPermissions]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "subscriptions") return;
        let cancelled = false;
        void loadSubscriptions().catch(error => {
            if (!cancelled) setAdminError(error instanceof Error ? error.message : "Could not load subscriptions.");
        });
        return () => { cancelled = true; };
    }, [authReady, user, tab, loadSubscriptions]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || tab !== "subscriptions") return;
        let cancelled = false;
        void Promise.all([loadSubscriptionUsers(), loadSubscriptionPlans(), loadAdminPlans()]).catch(error => {
            if (!cancelled) setAdminError(error instanceof Error ? error.message : "Could not load subscription options.");
        });
        return () => { cancelled = true; };
    }, [authReady, user, tab, loadSubscriptionUsers, loadSubscriptionPlans, loadAdminPlans]);

    const editingSubscription = subscriptions.find(item => item.shopId === editingSubscriptionId) ?? null;
    const selectedSubscriptionUser = subscriptionUsers.find(item => item.id === subscriptionDraft.userId) ?? null;
    const subscriptionShopOptions = editingSubscription
        ? [{ id: editingSubscription.shopId, name: editingSubscription.shopName }]
        : selectedSubscriptionUser?.shops.map(shop => ({ id: shop.id, name: shop.name })) ?? [];
    const selectedSubscriptionPlan = subscriptionPlans.find(plan => plan.id === subscriptionDraft.plan) ?? null;
    const subscriptionReadOnly = !permissions.canModerate || Boolean(subscriptionBusy);
    const canSaveSubscription = permissions.canModerate && !subscriptionBusy && (Boolean(editingSubscriptionId) || subscriptionShopOptions.length > 0);
    const planReadOnly = !permissions.canModerate || Boolean(planBusy);
    const canSavePlan = permissions.canModerate && !planBusy && Boolean(planDraft.name.trim());

    function beginPlanCreate() {
        setEditingPlanId("");
        setPlanDraft(emptyPlanDraft);
        setPlanFormError("");
    }

    function beginPlanEdit(plan: AdminPlan) {
        setEditingPlanId(plan.id);
        setPlanDraft({
            id: plan.id,
            name: plan.name,
            tagline: plan.tagline,
            monthlyPrice: String(plan.monthlyPrice),
            annualPrice: String(plan.annualPrice),
            commission: String(plan.commission),
            listingLimit: String(plan.listingLimit),
            sortOrder: String(plan.sortOrder),
            features: planFeaturesToText(plan.features),
            featured: plan.featured,
            active: plan.active
        });
        setPlanFormError("");
    }

    async function savePlan(event: FormEvent) {
        event.preventDefault();
        if (!permissions.canModerate || planBusy) return;
        const monthlyPrice = numericInput(planDraft.monthlyPrice);
        const annualPrice = numericInput(planDraft.annualPrice);
        const commission = numericInput(planDraft.commission);
        const listingLimit = numericInput(planDraft.listingLimit);
        const sortOrder = numericInput(planDraft.sortOrder);
        if (monthlyPrice < 0 || annualPrice < 0 || commission < 0 || commission > 100 || listingLimit < -1 || sortOrder < 0) {
            setPlanFormError("Enter valid prices, commission (0–100), listing limit (-1 for unlimited) and sort order.");
            return;
        }
        const payload = {
            ...(!editingPlanId && planDraft.id.trim() ? { id: planDraft.id.trim() } : {}),
            name: planDraft.name.trim(),
            tagline: planDraft.tagline.trim(),
            monthlyPrice,
            annualPrice,
            commission,
            listingLimit: Math.trunc(listingLimit),
            sortOrder: Math.trunc(sortOrder),
            featured: planDraft.featured,
            active: planDraft.active,
            features: parsePlanFeatures(planDraft.features)
        };
        setPlanBusy(editingPlanId || "create");
        setPlanFormError("");
        try {
            if (editingPlanId) {
                await apiFetch<AdminPlan>(`/admin/plans/${encodeURIComponent(editingPlanId)}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload)
                });
            } else {
                await apiFetch<AdminPlan>("/admin/plans", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
            }
            setAdminError("");
            setAdminNotice(editingPlanId ? "Plan updated." : "Plan created.");
            beginPlanCreate();
            await Promise.all([loadAdminPlans(), loadSubscriptionPlans()]);
        } catch (error) {
            setPlanFormError(error instanceof Error ? error.message : "Could not save this plan.");
            setAdminNotice("");
        } finally { setPlanBusy(""); }
    }

    async function deletePlan(plan: AdminPlan) {
        if (!permissions.canModerate || planBusy) return;
        if (!window.confirm(`Delete the ${plan.name} plan? Default and assigned plans are protected.`)) return;
        setPlanBusy(plan.id);
        try {
            await apiFetch(`/admin/plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
            setAdminError("");
            setAdminNotice(`Plan ${plan.name} deleted.`);
            if (editingPlanId === plan.id) beginPlanCreate();
            await Promise.all([loadAdminPlans(), loadSubscriptionPlans()]);
        } catch (error) {
            setPlanFormError(error instanceof Error ? error.message : "Could not delete this plan.");
            setAdminNotice("");
        } finally { setPlanBusy(""); }
    }

    function beginSubscriptionCreate() {
        setEditingSubscriptionId("");
        setSubscriptionDraft(emptySubscriptionDraft);
        setSubscriptionFormError("");
    }

    function beginSubscriptionEdit(item: AdminSubscription) {
        setEditingSubscriptionId(item.shopId);
        setSubscriptionDraft({
            userId: item.owner?.id ?? "",
            shopId: item.shopId,
            plan: subscriptionPlans.find(plan => plan.id === item.plan)?.id ?? "starter",
            subscriptionStatus: item.subscriptionStatus,
            billingCycle: item.billingCycle ?? "monthly",
            nextBillingDate: item.nextBillingDate ? item.nextBillingDate.slice(0, 10) : ""
        });
        setSubscriptionFormError("");
    }

    function applySubscriptionSearch(event: FormEvent) {
        event.preventDefault();
        setSubscriptionSearch(subscriptionSearchInput.trim());
        setSubscriptionPage(1);
    }

    async function saveSubscription(event: FormEvent) {
        event.preventDefault();
        if (!permissions.canModerate || subscriptionBusy) return;
        if (!editingSubscriptionId && !subscriptionDraft.userId) {
            setSubscriptionFormError("Select the account that owns this subscription.");
            return;
        }
        if (!editingSubscriptionId && subscriptionShopOptions.length === 0) {
            setSubscriptionFormError("The selected account does not have a shop yet.");
            return;
        }
        setSubscriptionBusy(editingSubscriptionId || "create");
        setSubscriptionFormError("");
        try {
            if (editingSubscriptionId) {
                await mutateBackendData("admin-update-subscription", {
                    shopId: editingSubscriptionId,
                    plan: subscriptionDraft.plan,
                    subscriptionStatus: subscriptionDraft.subscriptionStatus,
                    billingCycle: subscriptionDraft.billingCycle,
                    nextBillingDate: subscriptionDraft.nextBillingDate
                });
            } else {
                await mutateBackendData("admin-create-subscription", {
                    userId: subscriptionDraft.userId,
                    ...(subscriptionDraft.shopId ? { shopId: subscriptionDraft.shopId } : {}),
                    plan: subscriptionDraft.plan,
                    subscriptionStatus: subscriptionDraft.subscriptionStatus,
                    billingCycle: subscriptionDraft.billingCycle,
                    nextBillingDate: subscriptionDraft.nextBillingDate
                });
            }
            setAdminError("");
            setAdminNotice(editingSubscriptionId ? "Subscription updated." : "Subscription created.");
            beginSubscriptionCreate();
            await Promise.all([loadSubscriptions(), loadSubscriptionUsers(), loadAdminData(), refreshMarketplace()]);
        } catch (error) {
            setSubscriptionFormError(error instanceof Error ? error.message : "Could not save this subscription.");
            setAdminNotice("");
        } finally { setSubscriptionBusy(""); }
    }

    async function deleteSubscription(item: AdminSubscription) {
        if (!permissions.canModerate || subscriptionBusy) return;
        if (!window.confirm(`Delete the ${item.planName} subscription for ${item.shopName}? The shop and billing history are retained.`)) return;
        setSubscriptionBusy(item.shopId);
        try {
            await mutateBackendData("admin-delete-subscription", { shopId: item.shopId });
            setAdminError("");
            setAdminNotice(`Subscription deleted for ${item.shopName}.`);
            if (editingSubscriptionId === item.shopId) beginSubscriptionCreate();
            await Promise.all([loadSubscriptions(), loadAdminData(), refreshMarketplace()]);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not delete this subscription.");
            setAdminNotice("");
        } finally { setSubscriptionBusy(""); }
    }

    async function saveShop(next: AdminShop) {
        if (!permissions.canModerate) return;
        const updated = next.shopStatus === "Paused" || !next.verified ? { ...next, published: false } : next;
        setShops(current => current.map(item => item.slug === updated.slug ? updated : item));
        const { shop: label, shopStatus, ...fields } = updated;
        const record = { ...fields, name: label, status: shopStatus ?? "Active" };
        try {
            await mutateBackendData("admin-upsert-shop", { shop: record });
            await Promise.all([refreshMarketplace(), loadAdminData(), loadDashboard()]);
            setAdminError("");
            setAdminNotice("Shop controls updated.");
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not update this shop."); }
    }

    async function saveProductStatus(shop: AdminShop, product: AdminProduct, status: NonNullable<AdminProduct["status"]>) {
        if (!permissions.canModerate) return;
        setShops(current => current.map(item => item.slug === shop.slug
            ? { ...item, products: item.products.map(row => row.id === product.id || row.dbId === product.dbId ? { ...row, status } : row) }
            : item));
        try {
            await mutateBackendData("admin-set-product-status", { id: product.dbId ?? product.id, product: { ...product, status } });
            await Promise.all([refreshMarketplace(), loadAdminData()]);
            setAdminError("");
            setAdminNotice("Product status updated.");
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not update this product."); }
    }

    async function decideShop(shop: { id?: string; slug: string }, decision: "approve" | "reject") {
        if (!permissions.canModerate) return;
        const id = shop.id ?? shop.slug;
        const note = (shopNotes[id] ?? "").trim();
        if (decision === "reject" && !note) {
            setAdminError("Provide a reason before rejecting a shop verification.");
            return;
        }
        setPhase9Busy(`${decision}-${id}`);
        try {
            if (decision === "approve") {
                await mutateBackendData("admin-approve-shop", { id, note });
            } else {
                await mutateBackendData("admin-reject-shop", { id, reason: note });
            }
            setShopNotes(current => ({ ...current, [id]: "" }));
            setAdminError("");
            setAdminNotice(`Shop verification ${decision === "approve" ? "approved" : "rejected"}.`);
            await Promise.all([loadAdminData(), loadDashboard(), loadPendingShops(), refreshMarketplace()]);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : `Could not ${decision} this shop.`);
        } finally { setPhase9Busy(""); }
    }

    async function moderateProduct(product: ModerationProduct, status: ModerationStatus) {
        if (!permissions.canModerate) return;
        setPhase9Busy(`product-${product.id}`);
        try {
            await mutateBackendData("admin-moderate-product", { id: product.id, status, note: productNotes[product.id] ?? "" });
            setProductNotes(current => ({ ...current, [product.id]: "" }));
            setAdminError("");
            setAdminNotice(`Product marked ${status.toLowerCase()}.`);
            await Promise.all([loadModerationProducts(), loadAdminData(), loadDashboard(), refreshMarketplace()]);
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not moderate this product."); }
        finally { setPhase9Busy(""); }
    }

    async function moderateReview(review: AdminReview, status: ReviewStatus) {
        if (!permissions.canModerate) return;
        setPhase9Busy(`review-${review.id}`);
        try {
            await mutateBackendData("admin-moderate-review", { id: review.id, status, note: reviewNotes[review.id] ?? "" });
            setAdminError("");
            setAdminNotice(`Review marked ${status.toLowerCase()}.`);
            await Promise.all([loadReviews(), loadDashboard()]);
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not moderate this review."); }
        finally { setPhase9Busy(""); }
    }

    async function removeReview(review: AdminReview) {
        if (!permissions.canModerate) return;
        if (!window.confirm(`Delete the review by ${review.authorName}?`)) return;
        setPhase9Busy(`review-${review.id}`);
        try {
            await mutateBackendData("admin-delete-review", { id: review.id });
            setAdminError("");
            setAdminNotice("Review deleted.");
            await Promise.all([loadReviews(), loadDashboard()]);
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not delete this review."); }
        finally { setPhase9Busy(""); }
    }

    async function updateReviewSetting(enabled: boolean) {
        if (!permissions.canModerate) return;
        setPhase9Busy("review-setting");
        try {
            await mutateBackendData("admin-set-review-moderation", { enabled });
            setAdminError("");
            setAdminNotice(`New reviews will now be published ${enabled ? "after approval" : "immediately"}.`);
            await Promise.all([loadSettings(), loadDashboard()]);
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not update review moderation."); }
        finally { setPhase9Busy(""); }
    }

    async function updateUserPermission(userId: string, key: PermissionKey, value: boolean) {
        if (!permissions.canManageUsers) return;
        setPhase9Busy(`permission-${userId}-${key}`);
        try {
            await mutateBackendData("admin-update-user-permissions", { id: userId, permissions: { [key]: value } });
            setUserPermissions(current => {
                const base: AdminPermissions = current[userId] ?? { canManageFinance: false, canManageUsers: false, canModerate: false, canViewAudit: false };
                return { ...current, [userId]: { ...base, [key]: value } };
            });
            if (userId === user?.id) setPermissions(current => ({ ...current, [key]: value }));
            setAdminError("");
            setAdminNotice("Administrator permissions updated.");
            await loadDashboard();
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not update permissions.");
            await loadUserPermissions().catch(() => undefined);
        } finally { setPhase9Busy(""); }
    }

    async function revokeSessions(userId: string) {
        if (!permissions.canManageUsers) return;
        setPhase9Busy(`sessions-${userId}`);
        try {
            await mutateBackendData("admin-revoke-sessions", { id: userId });
            setAdminError("");
            setAdminNotice("Active sessions revoked.");
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not revoke sessions."); }
        finally { setPhase9Busy(""); }
    }

    function beginCategoryEdit(category: Category) {
        setEditingCategoryId(category.id);
        setCategoryDraft({ name: category.name, caption: category.caption, glyph: category.glyph });
        setCategoryError("");
    }
    async function refreshOrders() {
        try {
            const data = await readBackendData<{ orders: CustomerOrder[]; payments: PaymentState; paymentRecords: PaymentRecord[]; refundRecords: PaymentRefundRecord[] }>("admin");
            setOrders(data.orders);
            setPayments(data.payments);
            setPaymentRecords(data.paymentRecords ?? []);
            setRefundRecords(data.refundRecords ?? []);
            setAdminError("");
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not refresh orders."); }
    }

    async function updateFulfilment(order: CustomerOrder, status: OrderStatusKey) {
        if (orderBusy) return;
        setOrderBusy(order.id);
        try {
            const updated = await mutateBackendData<Record<string, unknown>>("update-order", {
                orderId: order.dbId ?? order.id,
                status,
                note: status === "REFUNDED" ? "Refunded by administrator" : `Moved to ${ADMIN_STATUS_LABELS[status]} by administrator`,
            });
            setOrders(current => current.map(item => item.id === order.id ? mapOrder(updated) : item));
            setAdminError("");
            setAdminNotice(`${order.id} moved to ${ADMIN_STATUS_LABELS[status]}.`);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not update this order.");
        } finally {
            setOrderBusy("");
        }
    }

    async function setPayment(orderId: string, status: PaymentState[string]) {
        if (orderBusy || !permissions.canManageFinance) return;
        setOrderBusy(orderId);
        try {
            if (status === "Refunded") {
                const updated = await mutateBackendData<Record<string, unknown>>("set-payment", { orderId, status });
                setOrders(current => current.map(item => item.id === orderId ? mapOrder(updated) : item));
            } else {
                await mutateBackendData("set-payment", { orderId, status });
            }
            setPayments(current => ({ ...current, [orderId]: status }));
            setAdminError("");
            setAdminNotice(`Payment for ${orderId} marked ${status.toLowerCase()}.`);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not update the payment record.");
        } finally {
            setOrderBusy("");
        }
    }
    async function verifyPaymentRecord(reference: string) {
        if (orderBusy || !permissions.canManageFinance) return;
        setOrderBusy(reference);
        try {
            await mutateBackendData("admin-verify-payment", { reference });
            await refreshOrders();
            setAdminError("");
            setAdminNotice(`Payment ${reference} verified against Paystack.`);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not verify this payment.");
        } finally { setOrderBusy(""); }
    }

    async function reconcilePayments() {
        if (reconcileBusy) return;
        setReconcileBusy(true);
        try {
            const report = await mutateBackendData<ReconciliationReport>("reconcile-payments", {});
            setReconciliation(report);
            await refreshOrders();
            setAdminError("");
            setAdminNotice(`Reconciled ${report.checked} payment record${report.checked === 1 ? "" : "s"} with Paystack.`);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not reconcile payments.");
        } finally { setReconcileBusy(false); }
    }

    async function saveCommission(value: string) {
        if (!permissions.canManageFinance) return;
        const rate = Math.min(100, Math.max(0, Number(value) || 0));
        setCommissionRate(String(rate));
        try {
            await mutateBackendData("set-settings", { settings: { commissionRate: rate } });
            setAdminError("");
            setAdminNotice(`Commission rate set to ${rate}%.`);
            await Promise.all([loadSettings(), loadDashboard(), loadFinance()]);
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not update the commission rate."); }
    }

    async function loadFinance() {
        const [report, queue, history] = await Promise.all([
            readBackendData<FinanceReport>("admin-finance-report"),
            readBackendData<{ items: Payout[] }>("admin-payouts"),
            readBackendData<{ items: SettlementRecord[] }>("admin-settlements")
        ]);
        setFinanceReport(report);
        setPayouts(queue.items);
        setSettlementRecords(history.items);
        setCommissionRate(String(report.commissionRate * 100));
    }

    useEffect(() => {
        if (!authReady || user?.role !== "admin" || (tab !== "overview" && tab !== "finance")) return;
        let cancelled = false;
        void loadFinance().catch(error => {
            if (!cancelled) setAdminError(error instanceof Error ? error.message : "Could not load financial records.");
        });
        return () => { cancelled = true; };
    }, [authReady, user, tab]);

    async function openPayout(id: string) {
        try { setPayoutDetail(await readBackendData<Payout>("admin-payout-detail", { id })); }
        catch (error) { setAdminError(error instanceof Error ? error.message : "Could not load payout details."); }
    }

    async function processPayout(id: string, action: "approve-payout" | "reject-payout" | "mark-payout-paid" | "fail-payout") {
        if (!permissions.canManageFinance) return;
        setFinanceBusy(id);
        try {
            const body: Record<string, unknown> = {};
            if (action === "reject-payout" || action === "fail-payout") {
                const reason = window.prompt(action === "reject-payout" ? "Reason for rejection" : "Reason for failure", "")?.trim();
                if (!reason) return;
                body.reason = reason;
            }
            await mutateBackendData(action, { id, body });
            setAdminError("");
            setAdminNotice(`Payout ${action.replace("-payout", "").replace("mark-", "marked ")} updated.`);
            await loadFinance();
            await openPayout(id);
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not update this payout.");
        } finally { setFinanceBusy(""); }
    }

    async function recordAdjustment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!permissions.canManageFinance) return;
        const shop = shops.find(item => item.id === adjustment.shopId || item.slug === adjustment.shopId);
        const amount = Number(adjustment.amount);
        if (!shop || !Number.isFinite(amount) || amount <= 0 || !adjustment.reference.trim()) {
            setAdminError("Select a shop, enter a positive amount and provide a unique reference."); return;
        }
        setFinanceBusy("adjustment");
        try {
            await mutateBackendData("create-settlement", {
                settlement: { sellerId: shop.id ?? shop.slug, shopId: shop.id ?? shop.slug, amount, reference: adjustment.reference.trim() }
            });
            setAdjustment({ shopId: "", amount: "", reference: "" });
            setAdminError(""); setAdminNotice("Settlement adjustment recorded.");
            await loadFinance();
        } catch (error) {
            setAdminError(error instanceof Error ? error.message : "Could not record this settlement.");
        } finally { setFinanceBusy(""); }
    }

    async function addCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!permissions.canModerate) return;
        const name = categoryName.trim();
        const id = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!id || categories.some(category => category.id === id)) { setCategoryError("Enter a unique category name."); return; }
        setCategoryError("");
        try {
            const category = await mutateBackendData<Category>("upsert-category", { category: { id, name, caption: categoryCaption.trim() || name, glyph: categoryGlyph.trim() || "🫙" } });
            setCategories(current => [...current, category]);
            setCategoryName(""); setCategoryCaption(""); setCategoryGlyph("");
            await refreshMarketplace();
            setAdminNotice("Category added.");
        } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not add this category."); }
    }

    async function saveCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editingCategoryId || !permissions.canModerate) return;
        setCategoryError("");
        try {
            const category = await mutateBackendData<Category>("update-category", { category: { id: editingCategoryId, ...categoryDraft } });
            setCategories(current => current.map(item => item.id === category.id ? category : item));
            setEditingCategoryId("");
            await refreshMarketplace();
            setAdminNotice("Category updated.");
        } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not update this category."); }
    }

    async function deleteCategory(id: string) {
        if (!permissions.canModerate) return;
        const category = categories.find(item => item.id === id);
        if (!category || !window.confirm(`Delete the ${category.name} category? Products using it will be uncategorised.`)) return;
        try {
            await mutateBackendData("delete-category", { id });
            setCategories(current => current.filter(item => item.id !== id));
            if (editingCategoryId === id) setEditingCategoryId("");
            await refreshMarketplace();
            setAdminNotice("Category deleted.");
        } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not delete this category."); }
    }

    async function saveUser(id: string, patch: Partial<Pick<AdminUser, "name" | "role" | "status">> & { emailVerified?: boolean }) {
        if (!permissions.canManageUsers) return;
        setUserError("");
        try {
            const updated = await apiFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
            setUsers(current => current.map(item => item.id === id ? { ...item, ...updated } : item));
            setUserNotice("User updated.");
        } catch (error) { setUserError(error instanceof Error ? error.message : "Could not update this user."); }
    }

    async function createUser(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!permissions.canManageUsers) return;
        setUserError("");
        try {
            const result = await apiFetch<{ user: AdminUser }>("/admin/users", {
                method: "POST",
                body: JSON.stringify(newUser)
            });
            setUsers(current => [result.user, ...current]);
            setNewUser({ name: "", email: "", password: "", role: "CUSTOMER", emailVerified: false });
            setUserNotice("Account created.");
        } catch (error) { setUserError(error instanceof Error ? error.message : "Could not create this account."); }
    }

    async function sendPasswordReset(id: string) {
        if (!permissions.canManageUsers) return;
        setUserError("");
        try {
            const result = await apiFetch<{ devToken?: string }>(`/admin/users/${id}/send-password-reset`, { method: "POST" });
            setUserNotice(result.devToken ? "Reset link ready in development mode." : "Password reset email sent.");
        } catch (error) { setUserError(error instanceof Error ? error.message : "Could not send a reset link."); }
    }

    if (!authReady || !ready || !user || user.role !== "admin") return <LoadingState label="Checking administrator access" />;
    const shop = shops.find(item => item.slug === selectedShopSlug) ?? shops[0] ?? null;
    const title = tabs.find(item => item.id === tab)?.label ?? "Overview";
    const visibleTabs = tabs.filter(item => {
        if (item.id === "reviews") return permissions.canModerate;
        if (item.id === "audit") return permissions.canViewAudit;
        if (item.id === "permissions") return permissions.canManageUsers;
        return true;
    });

    return <section className="oi-view oi-container oi-admin">
        <div className="oi-dashboard oi-admin__layout">
            <aside className="oi-sidebar">
                <div className="oi-sidebar__brand"><Logo size="sm" alt="Oilinga" /></div>
                <small className="oi-sidebar__label">ADMINISTRATION</small>
                <nav className="oi-sidebar__nav" aria-label="Admin navigation">{visibleTabs.map(item => <button key={item.id} type="button" className={`oi-sidebar__link${tab === item.id ? " is-active" : ""}`} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><Icon name={item.icon} size={16} />{item.label}</button>)}</nav>
                <div className="oi-sidebar__profile"><span className="oi-avatar">AD</span><div className="oi-sidebar__profile-text"><b className="oi-sidebar__profile-name">{user.name ?? "Administrator"}</b><small className="oi-sidebar__profile-meta">Backend connected</small></div></div>
            </aside>
            <div className="oi-dashboard__content oi-admin__content">
                <header className="oi-admin__header"><div><span className="oi-eyebrow oi-eyebrow--green">OILINGA ADMIN</span><h1>{title}</h1><p>Platform-wide operations, moderation and financial oversight.</p></div><Link className="oi-btn oi-btn--outline" href="/">View marketplace <Icon name="arrow-right" size={15} /></Link></header>
                <div className="oi-admin__notice"><Icon name="shield" size={17} /><p>Administrative access is role-gated and every mutation is written to the audit log. Financial actions require an explicit capability. Card payments are verified server-side through Paystack.</p></div>
                {adminError && <p className="oi-form-error" role="alert">{adminError}</p>}
                {adminNotice && <p className="oi-admin__muted" role="status">{adminNotice}</p>}

                {tab === "overview" && <>
                    <div className="oi-admin__metrics">
                        <article><span>Platform users</span><strong>{dashboard?.users.total ?? "—"}</strong></article>
                        <article><span>Active sellers</span><strong>{dashboard?.users.sellers ?? "—"}</strong></article>
                        <article><span>Verified shops</span><strong>{dashboard ? `${dashboard.shops.verified}/${dashboard.shops.total}` : "—"}</strong></article>
                        <article><span>Pending verification</span><strong>{dashboard?.shops.pendingVerification ?? "—"}</strong></article>
                        <article><span>Live products</span><strong>{dashboard?.products.active ?? "—"}</strong></article>
                        <article><span>Orders</span><strong>{dashboard?.orders.total ?? "—"}</strong></article>
                        <article><span>Successful payments</span><strong>{dashboard?.payments.successful ?? "—"}</strong></article>
                        <article><span>Reviews awaiting review</span><strong>{dashboard?.reviews.pending ?? "—"}</strong></article>
                    </div>
                    <div className="oi-admin__metrics oi-admin__metrics--finance">
                        <article><span>Gross order value</span><strong>{money(dashboard?.orders.grossValue ?? 0)}</strong></article>
                        <article><span>Commission rate</span><strong>{((dashboard?.finance.commissionRate ?? 0) * 100).toFixed(1)}%</strong></article>
                        <article><span>Settled to sellers</span><strong>{money(dashboard?.finance.settledAmount ?? 0)}</strong></article>
                        <article><span>Pending payouts</span><strong>{money(dashboard?.finance.payoutAmount ?? 0)}</strong></article>
                    </div>
                    <section className="oi-admin__panel"><h2>Needs attention</h2>
                        {pendingShops.length ? pendingShops.map(item => <div className="oi-admin__attention" key={item.id}><div><b>{item.name}</b><span>{item.owner?.name ?? item.slug} · {item.verificationRequestedAt ? new Date(item.verificationRequestedAt).toLocaleDateString() : "Application received"}</span></div><button className="oi-btn oi-btn--primary oi-btn--sm" type="button" onClick={() => { setSelectedShopSlug(item.slug); setTab("sellers"); }}>Review seller</button></div>)
                            : shops.filter(item => !item.verified).map(item => <div className="oi-admin__attention" key={item.slug}><div><b>{item.shop}</b><span>{item.owner} · {item.location}</span></div><button className="oi-btn oi-btn--primary oi-btn--sm" type="button" onClick={() => { setSelectedShopSlug(item.slug); setTab("sellers"); }}>Review seller</button></div>)}
                        {pendingShops.length === 0 && shops.filter(item => !item.verified).length === 0 && <p className="oi-admin__muted">No seller verification is pending.</p>}
                        {dashboard?.orders.total === 0 && <p className="oi-admin__muted">No orders have been placed yet.</p>}
                    </section>
                    {permissions.canViewAudit && dashboard?.recentAudit.length ? <section className="oi-admin__panel"><h2>Recent administrative activity</h2><div className="oi-admin__audit">{dashboard.recentAudit.map(item => <div className="oi-admin__attention" key={item.id}><div><b>{item.action.replaceAll("_", " ").toLowerCase()}</b><span>{item.actorName} · {new Date(item.createdAt).toLocaleString()}</span></div><span>{item.summary}</span></div>)}</div></section> : null}
                </>}

                {tab === "users" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Accounts and roles</h2><p>Manage customer, seller and administrator access.</p></div></div>
                        {!permissions.canManageUsers && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> User administration is disabled for this account. Contact an administrator with user-management access to make changes.</p>}
                        {userError && <p className="oi-form-error" role="alert">{userError}</p>}
                        {userNotice && <p className="oi-admin__muted" role="status">{userNotice}</p>}
                        <div className="oi-admin__table-wrap">
                            <table className="oi-admin__table"><thead><tr><th>User</th><th>Role</th><th>Email</th><th>Status</th><th>Recovery</th></tr></thead><tbody>
                                {users.map(item => <tr key={item.id}>
                                    <td><b>{item.name}</b><small>{item.emailVerifiedAt ? "Email verified" : "Email unverified"}</small></td>
                                    <td><select aria-label={`Role for ${item.email}`} value={item.role} disabled={!permissions.canManageUsers} onChange={event => saveUser(item.id, { role: event.target.value as AdminRole })}><option>CUSTOMER</option><option>SELLER</option><option>ADMIN</option></select></td>
                                    <td>{item.email}</td>
                                    <td><select aria-label={`Status for ${item.email}`} value={item.status} disabled={!permissions.canManageUsers} onChange={event => saveUser(item.id, { status: event.target.value as AdminUser["status"] })}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></td>
                                    <td><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={!permissions.canManageUsers} onClick={() => sendPasswordReset(item.id)}>Send reset</button></td>
                                </tr>)}
                            </tbody></table>
                            {users.length === 0 && <p className="oi-admin__muted">No accounts found.</p>}
                        </div>
                    </section>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Provision an account</h2><p>Create a customer, seller or administrator account with a hashed password.</p></div></div>
                        <form className="oi-admin__category-form" onSubmit={createUser}>
                            <label>Full name<input required disabled={!permissions.canManageUsers} value={newUser.name} onChange={event => setNewUser({ ...newUser, name: event.target.value })} placeholder="Amina Okafor" /></label>
                            <label>Email address<input required disabled={!permissions.canManageUsers} type="email" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} placeholder="amina@example.com" /></label>
                            <label>Temporary password<input required disabled={!permissions.canManageUsers} type="password" minLength={12} value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} placeholder="At least 12 characters" /></label>
                            <label>Role<select disabled={!permissions.canManageUsers} value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value as AdminRole })}><option>CUSTOMER</option><option>SELLER</option><option>ADMIN</option></select></label>
                            <label className="oi-check"><input type="checkbox" disabled={!permissions.canManageUsers} checked={newUser.emailVerified} onChange={event => setNewUser({ ...newUser, emailVerified: event.target.checked })} /><span>Mark this email as verified</span></label>
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={!permissions.canManageUsers}>Create account</button>
                        </form>
                    </section>
                </>}

                {tab === "sellers" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Seller applications</h2><p>Review verification requests. Approvals allow publication; rejections require a recorded reason.</p></div><span className="oi-admin__muted">{pendingShops.length} pending</span></div>
                        {!permissions.canModerate && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Marketplace moderation is disabled for this account, so verification decisions are read-only.</p>}
                        {pendingShops.length ? pendingShops.map(shop => <article className="oi-admin__seller-card" key={shop.id}>
                            <div className="oi-admin__seller-avatar">{shop.name.slice(0, 2).toUpperCase()}</div>
                            <div className="oi-admin__seller-main">
                                <h3>{shop.name}</h3>
                                <p>{shop.owner?.name ?? "Unknown owner"} · {shop.owner?.email ?? shop.slug}</p>
                                <small>{shop.verificationRequestedAt ? `Requested ${new Date(shop.verificationRequestedAt).toLocaleString()}` : "Verification requested"}</small>
                                {shop.verificationNote && <small>Previous note: {shop.verificationNote}</small>}
                            </div>
                            <span className={`oi-admin__badge${shop.verificationStatus === "REJECTED" ? " is-rejected" : " is-pending"}`}>{shop.verificationStatus.toLowerCase()}</span>
                            <div className="oi-admin__seller-actions">
                                <input className="oi-admin__decision-note" aria-label={`Decision note for ${shop.name}`} value={shopNotes[shop.id] ?? ""} disabled={!permissions.canModerate || Boolean(phase9Busy)} placeholder="Approval note or rejection reason" onChange={event => setShopNotes(current => ({ ...current, [shop.id]: event.target.value }))} />
                                <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={!permissions.canModerate || phase9Busy === `approve-${shop.id}`} onClick={() => void decideShop(shop, "approve")}>{phase9Busy === `approve-${shop.id}` ? "Approving…" : "Approve"}</button>
                                <button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={!permissions.canModerate || phase9Busy === `reject-${shop.id}`} onClick={() => void decideShop(shop, "reject")}>{phase9Busy === `reject-${shop.id}` ? "Rejecting…" : "Reject"}</button>
                            </div>
                        </article>) : <p className="oi-admin__muted">No verification applications are pending.</p>}
                    </section>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Shop controls</h2><p>Pause a storefront, manage verification or jump to its product catalogue.</p></div><span className="oi-admin__muted">{shops.length} registered</span></div>
                        {shops.length ? shops.map(item => {
                            const statusLabel = item.verificationStatus === "REJECTED" ? "Rejected" : item.verified ? "Verified" : item.verificationStatus === "PENDING" ? "Pending" : "Unverified";
                            const badgeClass = item.verified ? " is-approved" : item.verificationStatus === "REJECTED" ? " is-rejected" : " is-pending";
                            return <article className="oi-admin__seller-card" key={item.slug}>
                                <div className="oi-admin__seller-avatar">{item.shop.slice(0, 2).toUpperCase()}</div>
                                <div className="oi-admin__seller-main">
                                    <h3>{item.shop}</h3><p>{item.owner} · {item.location}</p>
                                    <small>{item.tagline || "No shop introduction provided."}</small>
                                    {item.verificationNote && <small>Verification note: {item.verificationNote}</small>}
                                </div>
                                <span className={`oi-admin__badge${badgeClass}`}>{statusLabel}</span>
                                <div className="oi-admin__seller-actions">
                                    <label>Status<select aria-label={`Status for ${item.shop}`} value={item.shopStatus ?? "Active"} disabled={!permissions.canModerate} onChange={event => void saveShop({ ...item, shopStatus: event.target.value as AdminShop["shopStatus"] })}><option>Active</option><option>Paused</option></select></label>
                                    <input className="oi-admin__decision-note" aria-label={`Verification note for ${item.shop}`} value={shopNotes[item.id ?? item.slug] ?? ""} disabled={!permissions.canModerate || Boolean(phase9Busy)} placeholder={item.verified ? "Reason for revoking verification" : "Approval note or rejection reason"} onChange={event => setShopNotes(current => ({ ...current, [item.id ?? item.slug]: event.target.value }))} />
                                    {item.published && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={!permissions.canModerate} onClick={() => void saveShop({ ...item, published: false })}>Unpublish</button>}
                                    {!item.verified ? <>
                                        <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={!permissions.canModerate || phase9Busy === `approve-${item.id ?? item.slug}`} onClick={() => void decideShop(item, "approve")}>Approve</button>
                                        <button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={!permissions.canModerate || phase9Busy === `reject-${item.id ?? item.slug}`} onClick={() => void decideShop(item, "reject")}>Reject</button>
                                    </> : <button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={!permissions.canModerate || phase9Busy === `reject-${item.id ?? item.slug}`} onClick={() => void decideShop(item, "reject")}>Revoke verification</button>}
                                    <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => { setSelectedShopSlug(item.slug); setTab("products"); }}>Products</button>
                                </div>
                            </article>;
                        }) : <p className="oi-admin__muted">No seller shops have been registered.</p>}
                    </section>
                </>}

                {tab === "products" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Product categories</h2><p>Manage the categories sellers can choose when they add products.</p></div></div>
                        {!permissions.canModerate && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Category changes require marketplace moderation access.</p>}
                        <div className="oi-admin__category-list">{categories.map(category => editingCategoryId === category.id
                            ? <form className="oi-admin__category-chip oi-admin__category-chip--editing" key={category.id} onSubmit={saveCategory}>
                                <label>Name<input required disabled={!permissions.canModerate} value={categoryDraft.name} onChange={event => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></label>
                                <label>Description<input disabled={!permissions.canModerate} value={categoryDraft.caption} onChange={event => setCategoryDraft({ ...categoryDraft, caption: event.target.value })} /></label>
                                <label>Icon<input maxLength={8} disabled={!permissions.canModerate} value={categoryDraft.glyph} onChange={event => setCategoryDraft({ ...categoryDraft, glyph: event.target.value })} /></label>
                                <div className="oi-admin__category-actions"><button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={!permissions.canModerate}>Save</button><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => setEditingCategoryId("")}>Cancel</button></div>
                            </form>
                            : <div className="oi-admin__category-chip" key={category.id}>
                                <span aria-hidden="true">{category.glyph}</span><b>{category.name}</b><small>{category.caption}</small><small>{category.id}</small>
                                <div className="oi-admin__category-actions"><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={!permissions.canModerate} onClick={() => beginCategoryEdit(category)}>Edit</button><button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={!permissions.canModerate} onClick={() => void deleteCategory(category.id)}>Delete</button></div>
                            </div>)}</div>
                        <form className="oi-admin__category-form" onSubmit={addCategory}>
                            <label>Category name<input required disabled={!permissions.canModerate} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="e.g. Shea Oil" /></label>
                            <label>Description<input disabled={!permissions.canModerate} value={categoryCaption} onChange={event => setCategoryCaption(event.target.value)} placeholder="Short category description" /></label>
                            <label>Icon<input disabled={!permissions.canModerate} value={categoryGlyph} onChange={event => setCategoryGlyph(event.target.value)} maxLength={8} placeholder="🫙" /></label>
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={!permissions.canModerate}>Add category</button>
                        </form>
                        {categoryError && <p className="oi-form-error" role="alert">{categoryError}</p>}
                    </section>
                    {permissions.canModerate && <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Product moderation queue</h2><p>Flagged listings stay out of the public catalogue until an administrator approves them.</p></div><span className="oi-admin__muted">{moderationProducts.length} flagged</span></div>
                        {moderationProducts.length ? <div className="oi-admin__table-wrap">
                            <table className="oi-admin__table">
                                <thead><tr><th>Product</th><th>Shop</th><th>Moderation</th><th>Decision note</th><th>Actions</th></tr></thead>
                                <tbody>{moderationProducts.map(product => <tr key={product.id}>
                                    <td><b>{product.name}</b><small>{product.slug} · {money(Number(product.price) || 0)}</small></td>
                                    <td>{product.shop?.name ?? product.shop?.slug ?? "—"}</td>
                                    <td><span className={`oi-admin__badge${product.moderationStatus === "APPROVED" ? " is-approved" : product.moderationStatus === "REJECTED" ? " is-rejected" : " is-pending"}`}>{product.moderationStatus.toLowerCase()}</span>{product.moderationNote && <small>{product.moderationNote}</small>}</td>
                                    <td><input className="oi-admin__decision-note" aria-label={`Moderation note for ${product.name}`} value={productNotes[product.id] ?? ""} disabled={Boolean(phase9Busy)} placeholder="Optional note" onChange={event => setProductNotes(current => ({ ...current, [product.id]: event.target.value }))} /></td>
                                    <td><div className="oi-admin__row-actions">
                                        <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={phase9Busy === `product-${product.id}`} onClick={() => void moderateProduct(product, "APPROVED")}>Approve</button>
                                        <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={phase9Busy === `product-${product.id}`} onClick={() => void moderateProduct(product, "PENDING")}>Hold</button>
                                        <button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={phase9Busy === `product-${product.id}`} onClick={() => void moderateProduct(product, "REJECTED")}>Reject</button>
                                    </div></td>
                                </tr>)}</tbody>
                            </table>
                        </div> : <p className="oi-admin__muted">No products are awaiting moderation.</p>}
                    </section>}
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Shop and product management</h2><p>Pause a storefront or change individual listing status. Changes write to the catalogue immediately.</p></div>{shops.length > 1 && <label className="oi-admin__rate">Select shop<select value={shop?.slug ?? ""} onChange={event => setSelectedShopSlug(event.target.value)}>{shops.map(item => <option key={item.slug} value={item.slug}>{item.shop}</option>)}</select></label>}</div>
                        {!permissions.canModerate && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Shop and listing controls require marketplace moderation access.</p>}
                        {shop ? <>
                            <div className="oi-admin__shop-control">
                                <div><b>{shop.shop}</b><span>{shop.location} · {shop.verified ? "Verified" : "Unverified"} · {shop.published ? "Published" : "Unpublished"}</span></div>
                                <div className="oi-admin__shop-actions">
                                    {shop.published && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={!permissions.canModerate} onClick={() => void saveShop({ ...shop, published: false })}>Unpublish</button>}
                                    <label>Shop status<select value={shop.shopStatus ?? "Active"} disabled={!permissions.canModerate} onChange={event => void saveShop({ ...shop, shopStatus: event.target.value as AdminShop["shopStatus"] })}><option>Active</option><option>Paused</option></select></label>
                                </div>
                            </div>
                            <div className="oi-admin__table-wrap">
                                <table className="oi-admin__table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Listing status</th></tr></thead><tbody>
                                    {shop.products.map((item, index) => <tr key={item.dbId ?? item.id ?? `${item.name}-${index}`}>
                                        <td><div className="oi-admin__product-cell">{item.imageUrl && <img src={item.imageUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} />}<div><b>{item.name}</b><small>{item.size}{item.category ? ` · ${item.category}` : ""}</small></div></div></td>
                                        <td>{money(Number(item.price) || 0)}</td>
                                        <td>{item.stock}</td>
                                        <td><select aria-label={`${item.name} listing status`} value={item.status ?? "Active"} disabled={!permissions.canModerate} onChange={event => void saveProductStatus(shop, item, event.target.value as NonNullable<AdminProduct["status"]>)}><option>Active</option><option>Draft</option><option>Out of stock</option></select></td>
                                    </tr>)}
                                </tbody></table>
                                {shop.products.length === 0 && <p className="oi-admin__muted">No seller products are registered.</p>}
                            </div>
                        </> : <p className="oi-admin__muted">No shop is available to manage.</p>}
                    </section>
                </>}

                {tab === "orders" && (
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading">
                            <div>
                                <h2>Orders and payment review</h2>
                                <p>Statuses follow the fulfilment lifecycle. Refunds are recorded against the original payment.</p>
                            </div>
                            <button type="button" className="oi-btn oi-btn--outline oi-btn--sm" onClick={() => void refreshOrders()}>
                                <Icon name="receipt" size={15} /> Refresh
                            </button>
                        </div>
                        {orders.length ? (
                            <div className="oi-admin__table-wrap">
                                <table className="oi-admin__table">
                                    <thead><tr><th>Order</th><th>Customer &amp; items</th><th>Total</th><th>Fulfilment</th><th>Payment</th></tr></thead>
                                    <tbody>
                                        {orders.map(order => {
                                            const busy = orderBusy === order.id;
                                            const next = ORDER_TRANSITIONS[order.statusKey] ?? [];
                                            return (
                                                <tr key={order.id}>
                                                    <td><b>{order.id}</b><small>{new Date(order.date).toLocaleDateString()}</small></td>
                                                    <td>
                                                        {order.delivery.name}
                                                        <small>{order.items.map(item => `${item.quantity} × ${item.product.name}`).join(", ")}</small>
                                                        <small>{order.delivery.phone}</small>
                                                    </td>
                                                    <td><b>{money(order.total)}</b><small>{order.events.length} status event{order.events.length === 1 ? "" : "s"}</small></td>
                                                    <td>
                                                        <select
                                                            aria-label={`Fulfilment status for ${order.id}`}
                                                            value={order.statusKey}
                                                            disabled={busy || next.length === 0}
                                                            onChange={event => void updateFulfilment(order, event.target.value as OrderStatusKey)}
                                                        >
                                                            <option value={order.statusKey}>{ADMIN_STATUS_LABELS[order.statusKey]}</option>
                                                            {next.map(status => <option key={status} value={status}>{ADMIN_STATUS_LABELS[status]}</option>)}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        {(() => {
                                                            const record = paymentRecords.find(item => item.orderId === order.dbId || item.orderNumber === order.id);
                                                            if (order.payment === "card" || record?.provider === "PAYSTACK") {
                                                                return <span className={cn("oi-payment-status", `is-${(record?.status ?? "PENDING").toLowerCase()}`)}>{record?.status === "SUCCESS" ? "Confirmed" : record?.status === "PARTIALLY_REFUNDED" ? "Partial refund" : record?.status ?? "Pending"}</span>;
                                                            }
                                                            return <select
                                                                aria-label={`Payment status for ${order.id}`}
                                                                value={payments[order.id] ?? "Pending"}
                                                                disabled={busy || !permissions.canManageFinance}
                                                                onChange={event => void setPayment(order.id, event.target.value as PaymentState[string])}
                                                            >
                                                                {["Pending", "Confirmed", "Failed", "Refunded"].map(status => <option key={status}>{status}</option>)}
                                                            </select>;
                                                        })()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="oi-admin__empty"><Icon name="receipt" size={24} /><h3>No orders to review</h3><p>Orders placed on the marketplace will appear here.</p></div>
                        )}
                    </section>
                )}

                {tab === "payments" && (
                    <>
                        <section className="oi-admin__panel">
                            <div className="oi-admin__panel-heading">
                                <div>
                                    <h2>Payment records</h2>
                                    <p>Transactions are verified server-side. Gateway amounts and statuses must match the order before fulfilment.</p>
                                </div>
                                <button type="button" className="oi-btn oi-btn--outline oi-btn--sm" onClick={() => void reconcilePayments()} disabled={reconcileBusy || !permissions.canManageFinance}>
                                    <Icon name="shield" size={15} /> {reconcileBusy ? "Reconciling…" : "Reconcile with Paystack"}
                                </button>
                            </div>
                            {!permissions.canManageFinance && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Verification and reconciliation require financial authorization. Payment records remain read-only for this account.</p>}

                            {reconciliation && (
                                <div className="oi-reconciliation">
                                    <div className="oi-reconciliation__metrics">
                                        <article><span>Checked</span><strong>{reconciliation.checked}</strong></article>
                                        <article><span>Matched</span><strong>{reconciliation.matched}</strong></article>
                                        <article><span>Mismatches</span><strong className={reconciliation.mismatches.length ? "is-alert" : undefined}>{reconciliation.mismatches.length}</strong></article>
                                        <article><span>Gateway successful</span><strong>{money(reconciliation.totals.gatewaySuccessfulKobo / 100)}</strong></article>
                                    </div>
                                    {reconciliation.mismatches.length === 0 ? (
                                        <p className="oi-reconciliation__ok"><Icon name="check" size={14} /> Every local payment record agrees with Paystack.</p>
                                    ) : (
                                        <div className="oi-admin__table-wrap">
                                            <table className="oi-admin__table">
                                                <thead><tr><th>Reference</th><th>Order</th><th>Local</th><th>Gateway</th><th>Issue</th></tr></thead>
                                                <tbody>
                                                    {reconciliation.mismatches.map(mismatch => (
                                                        <tr key={mismatch.reference}>
                                                            <td><b>{mismatch.reference}</b></td>
                                                            <td>{mismatch.orderNumber}</td>
                                                            <td>{mismatch.localStatus} · {money(mismatch.localAmountKobo / 100)}</td>
                                                            <td>{mismatch.gatewayStatus} · {money(mismatch.gatewayAmountKobo / 100)}</td>
                                                            <td><span className="oi-payment-status is-failed">{mismatch.issue}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {paymentRecords.length ? (
                                <div className="oi-admin__table-wrap">
                                    <table className="oi-admin__table">
                                        <thead><tr><th>Reference</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Verified</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {paymentRecords.map(payment => (
                                                <tr key={payment.id}>
                                                    <td><b>{payment.reference}</b><small>{payment.provider.replaceAll("_", " ").toLowerCase()}</small></td>
                                                    <td>{payment.orderNumber ?? "—"}</td>
                                                    <td>{payment.customer ?? "—"}</td>
                                                    <td><b>{money(payment.amount)}</b><small>{payment.currency}</small></td>
                                                    <td><span className={cn("oi-payment-status", `is-${payment.status.toLowerCase()}`)}>{payment.status.replaceAll("_", " ").toLowerCase()}</span></td>
                                                    <td>{payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString() : "—"}</td>
                                                    <td>
                                                        {payment.provider === "PAYSTACK" && payment.status !== "SUCCESS" && payment.status !== "REFUNDED" ? (
                                                            <button type="button" className="oi-btn oi-btn--outline oi-btn--sm" disabled={orderBusy === payment.reference || !permissions.canManageFinance} onClick={() => void verifyPaymentRecord(payment.reference)}>
                                                                {orderBusy === payment.reference ? "Checking…" : "Verify"}
                                                            </button>
                                                        ) : <span className="oi-admin__muted">—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="oi-admin__empty"><Icon name="lock" size={24} /><h3>No payment records yet</h3><p>Customer payments will appear here once an order is paid for.</p></div>}
                        </section>

                        <section className="oi-admin__panel">
                            <div className="oi-admin__panel-heading"><div><h2>Refund trail</h2><p>Every gateway refund attempt is recorded with its reference and outcome.</p></div></div>
                            {refundRecords.length ? (
                                <div className="oi-admin__table-wrap">
                                    <table className="oi-admin__table">
                                        <thead><tr><th>Reference</th><th>Order</th><th>Payment</th><th>Amount</th><th>Status</th><th>Reason</th></tr></thead>
                                        <tbody>
                                            {refundRecords.map(refund => (
                                                <tr key={refund.id}>
                                                    <td><b>{refund.reference}</b><small>{new Date(refund.createdAt).toLocaleDateString()}</small></td>
                                                    <td>{refund.orderNumber}</td>
                                                    <td>{refund.paymentReference}</td>
                                                    <td><b>{money(refund.amount)}</b></td>
                                                    <td><span className={cn("oi-payment-status", `is-${refund.status.toLowerCase()}`)}>{refund.status.toLowerCase()}</span></td>
                                                    <td>{refund.reason ?? "—"}{refund.error ? <small>{refund.error}</small> : null}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="oi-admin__muted">No refunds have been recorded.</p>}
                        </section>
                    </>
                )}

                {tab === "finance" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Platform finance</h2><p>Live figures from order lines, payments, payouts and settlements.</p></div><label className="oi-admin__rate">Commission rate (%)<input type="number" min="0" max="100" step="0.1" disabled={!permissions.canManageFinance} value={commissionRate} onChange={event => saveCommission(event.target.value)} /></label></div>
                        {!permissions.canManageFinance && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Financial actions are disabled for this account. Figures remain visible, but rates, payouts and settlements are read-only.</p>}
                        <div className="oi-admin__metrics oi-admin__metrics--finance">
                            <article><span>Gross sales</span><strong>{money(financeReport?.totals.grossSales ?? 0)}</strong></article>
                            <article><span>Commission</span><strong>{money(financeReport?.totals.commission ?? 0)}</strong></article>
                            <article><span>Net seller earnings</span><strong>{money(financeReport?.totals.netEarnings ?? 0)}</strong></article>
                            <article><span>Paid out</span><strong>{money(financeReport?.totals.paidOut ?? 0)}</strong></article>
                            <article><span>Pending payouts</span><strong>{money(financeReport?.totals.pendingPayouts ?? 0)}</strong></article>
                            <article><span>Available balance</span><strong>{money(financeReport?.totals.availableBalance ?? 0)}</strong></article>
                        </div>
                        <div className="oi-reconciliation__ok">
                            <Icon name="shield" size={15} />
                            <span>{financeReport?.reconciliation.available
                                ? `Payment reconciliation: ${financeReport.reconciliation.matched}/${financeReport.reconciliation.checked} matched, ${financeReport.reconciliation.mismatches} mismatch${financeReport.reconciliation.mismatches === 1 ? "" : "es"}.`
                                : financeReport?.reconciliation.message ?? "Payment reconciliation is unavailable."}</span>
                        </div>
                    </section>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Payout queue</h2><p>Seller requests stay pending until an administrator approves and confirms payment.</p></div></div>
                        {payouts.length ? (
                            <div className="oi-seller-table-wrap"><table className="oi-seller-table"><thead><tr><th>Seller</th><th>Reference</th><th>Requested</th><th>Status</th><th className="oi-seller-table__right">Amount</th><th className="oi-seller-table__right">Actions</th></tr></thead><tbody>{payouts.map(payout => (
                                <tr key={payout.id}>
                                    <td><b>{payout.sellerName ?? payout.shopName ?? "Seller"}</b><small>{payout.shopName ?? payout.shopId}</small></td>
                                    <td><b>{payout.reference}</b><small>{payout.note ?? "—"}</small></td>
                                    <td>{new Date(payout.requestedAt).toLocaleDateString()}</td>
                                    <td><span className={`oi-payout-badge oi-payout-badge--${payout.status.toLowerCase()}`}>{payout.status.toLowerCase()}</span></td>
                                    <td className="oi-seller-table__right">{money(payout.amount)}</td>
                                    <td className="oi-seller-table__right"><div className="oi-admin__row-actions">
                                        <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => void openPayout(payout.id)}>Details</button>
                                        {payout.status === "REQUESTED" && <>
                                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={financeBusy === payout.id || !permissions.canManageFinance} onClick={() => void processPayout(payout.id, "approve-payout")}>Approve</button>
                                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={financeBusy === payout.id || !permissions.canManageFinance} onClick={() => void processPayout(payout.id, "reject-payout")}>Reject</button>
                                        </>}
                                        {(payout.status === "APPROVED" || payout.status === "PROCESSING") && <>
                                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={financeBusy === payout.id || !permissions.canManageFinance} onClick={() => void processPayout(payout.id, "mark-payout-paid")}>Mark paid</button>
                                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={financeBusy === payout.id || !permissions.canManageFinance} onClick={() => void processPayout(payout.id, "fail-payout")}>Fail</button>
                                        </>}
                                    </div></td>
                                </tr>
                            ))}</tbody></table></div>
                        ) : <p className="oi-admin__muted">No payout requests yet.</p>}
                    </section>
                    {payoutDetail && <section className="oi-admin__panel"><div className="oi-admin__panel-heading"><div><h2>Payout audit · {payoutDetail.reference}</h2><p>{money(payoutDetail.amount)} · {payoutDetail.status.toLowerCase()}</p></div><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => setPayoutDetail(null)}>Close</button></div><div className="oi-admin__audit">{payoutDetail.events?.length ? payoutDetail.events.map(event => <div className="oi-admin__attention" key={event.id}><div><b>{event.toStatus.toLowerCase()}</b><span>{event.actorName ?? event.actorRole ?? "System"} · {new Date(event.createdAt).toLocaleString()}</span></div><span>{event.note ?? event.reference ?? "—"}</span></div>) : <p className="oi-admin__muted">No audit events recorded.</p>}</div></section>}
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Settlement history</h2><p>Sale payouts and admin adjustments. Subscription charges are excluded.</p></div></div>
                        <form className="oi-admin__inline-form" onSubmit={event => void recordAdjustment(event)}>
                            <label>Shop<select value={adjustment.shopId} disabled={!permissions.canManageFinance} onChange={event => setAdjustment({ ...adjustment, shopId: event.target.value })}><option value="">Select a shop</option>{shops.map(item => <option key={item.id} value={item.id}>{item.shop}</option>)}</select></label>
                            <label>Amount (₦)<input type="number" min="1" step="0.01" disabled={!permissions.canManageFinance} value={adjustment.amount} onChange={event => setAdjustment({ ...adjustment, amount: event.target.value })} /></label>
                            <label>Unique reference<input type="text" disabled={!permissions.canManageFinance} value={adjustment.reference} onChange={event => setAdjustment({ ...adjustment, reference: event.target.value })} placeholder="ADJ-2026-001" /></label>
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={financeBusy === "adjustment" || !permissions.canManageFinance}>Record adjustment</button>
                        </form>
                        {settlementRecords.length ? (
                            <div className="oi-seller-table-wrap"><table className="oi-seller-table"><thead><tr><th>Reference</th><th>Seller</th><th>Kind</th><th>Date</th><th>Status</th><th className="oi-seller-table__right">Amount</th></tr></thead><tbody>{settlementRecords.map(record => (
                                <tr key={record.id}>
                                    <td><b>{record.reference ?? record.id}</b><small>{record.payoutId ? `Payout ${record.payoutId}` : "Manual adjustment"}</small></td>
                                    <td>{record.shopId ?? record.sellerId}</td>
                                    <td>{record.kind.toLowerCase()}</td>
                                    <td>{new Date(record.createdAt).toLocaleDateString()}</td>
                                    <td>{record.status}</td>
                                    <td className="oi-seller-table__right">{money(record.amount)}</td>
                                </tr>
                            ))}</tbody></table></div>
                        ) : <p className="oi-admin__muted">No sale settlements or adjustments recorded.</p>}
                    </section>
                </>}

                {tab === "subscriptions" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading">
                            <div><h2>{editingPlanId ? "Edit plan" : "Create plan"}</h2><p>Prices, commission and features here drive public pricing and Paystack verification.</p></div>
                            {editingPlanId && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={beginPlanCreate}>New plan</button>}
                        </div>
                        {!permissions.canModerate && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Plan changes require marketplace moderation access.</p>}
                        <form className="oi-admin__plan-form" onSubmit={event => void savePlan(event)}>
                            <label>Plan id<input type="text" value={planDraft.id} disabled={planReadOnly || Boolean(editingPlanId)} placeholder="generated from name" onChange={event => setPlanDraft(current => ({ ...current, id: event.target.value }))} /></label>
                            <label>Name<input type="text" value={planDraft.name} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, name: event.target.value }))} /></label>
                            <label className="oi-admin__plan-field--wide">Tagline<input type="text" value={planDraft.tagline} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, tagline: event.target.value }))} /></label>
                            <label>Monthly price (₦)<input type="number" min="0" step="0.01" value={planDraft.monthlyPrice} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, monthlyPrice: event.target.value }))} /></label>
                            <label>Annual price / month (₦)<input type="number" min="0" step="0.01" value={planDraft.annualPrice} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, annualPrice: event.target.value }))} /></label>
                            <label>Commission (%)<input type="number" min="0" max="100" step="0.01" value={planDraft.commission} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, commission: event.target.value }))} /></label>
                            <label>Listing limit<input type="number" min="-1" step="1" value={planDraft.listingLimit} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, listingLimit: event.target.value }))} /></label>
                            <label>Sort order<input type="number" min="0" step="1" value={planDraft.sortOrder} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, sortOrder: event.target.value }))} /></label>
                            <label className="oi-admin__plan-toggle"><input type="checkbox" checked={planDraft.featured} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, featured: event.target.checked }))} /> Featured on pricing</label>
                            <label className="oi-admin__plan-toggle"><input type="checkbox" checked={planDraft.active} disabled={planReadOnly} onChange={event => setPlanDraft(current => ({ ...current, active: event.target.checked }))} /> Active / purchasable</label>
                            <label className="oi-admin__plan-field--wide">Features<textarea rows={5} value={planDraft.features} disabled={planReadOnly} placeholder={"+ Included feature\n- Excluded feature"} onChange={event => setPlanDraft(current => ({ ...current, features: event.target.value }))} /><small>One feature per line. Prefix with “+” for included or “-” for excluded.</small></label>
                            <div className="oi-admin__subscription-actions">
                                <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={!canSavePlan} aria-busy={Boolean(planBusy)}>{planBusy ? "Saving…" : editingPlanId ? "Save plan" : "Create plan"}</button>
                                {editingPlanId && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={beginPlanCreate}>Cancel</button>}
                            </div>
                        </form>
                        {planFormError && <p className="oi-form-error">{planFormError}</p>}
                        <div className="oi-admin__table-wrap">
                            <table className="oi-admin__table">
                                <thead><tr><th>Plan</th><th>Monthly</th><th>Annual / mo</th><th>Commission</th><th>Listings</th><th>Status</th><th>Order</th><th className="oi-seller-table__right">Actions</th></tr></thead>
                                <tbody>{adminPlans.map(plan => (
                                    <tr key={plan.id}>
                                        <td><b>{plan.name}</b><small>{plan.id}</small></td>
                                        <td>{money(plan.monthlyPrice)}</td>
                                        <td>{money(plan.annualPrice)}</td>
                                        <td>{plan.commission}%</td>
                                        <td>{plan.listingLimit === -1 ? "Unlimited" : plan.listingLimit}</td>
                                        <td><span className={`oi-admin__badge ${plan.active ? "is-approved" : "is-rejected"}`}>{plan.active ? "Active" : "Inactive"}</span></td>
                                        <td>{plan.sortOrder}</td>
                                        <td><div className="oi-admin__row-actions"><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={planReadOnly || planBusy === plan.id} onClick={() => beginPlanEdit(plan)}>Edit</button><button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={planReadOnly || planBusy === plan.id} onClick={() => void deletePlan(plan)}>Delete</button></div></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        <div className="oi-admin__plan-note"><Icon name="shield" size={17} /><span>Inactive plans are hidden from public pricing and cannot be purchased. The default plan and plans already assigned to shops cannot be deleted; reassign or deactivate them instead.</span></div>
                    </section>

                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading">
                            <div><h2>{editingSubscriptionId ? "Edit subscription" : "Create subscription"}</h2><p>Assign a backend plan to a user's shop without creating payment records.</p></div>
                            {editingSubscriptionId && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={beginSubscriptionCreate}>New subscription</button>}
                        </div>
                        {!permissions.canModerate && <p className="oi-admin__read-only"><Icon name="lock" size={15} /> Creating, editing and deleting subscriptions requires marketplace moderation access.</p>}
                        <form className="oi-admin__subscription-form" onSubmit={event => void saveSubscription(event)}>
                            <label>Account<select
                                value={subscriptionDraft.userId}
                                disabled={subscriptionReadOnly || Boolean(editingSubscriptionId)}
                                onChange={event => setSubscriptionDraft(current => ({ ...current, userId: event.target.value, shopId: "" }))}
                            >
                                <option value="">Select an account</option>
                                {subscriptionUsers.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                                {editingSubscription?.owner && !subscriptionUsers.some(user => user.id === editingSubscription.owner?.id) && (
                                    <option value={editingSubscription.owner.id}>{editingSubscription.owner.name} · {editingSubscription.owner.email}</option>
                                )}
                            </select></label>
                            <label>Shop<select
                                value={subscriptionDraft.shopId || subscriptionShopOptions[0]?.id || ""}
                                disabled={subscriptionReadOnly || Boolean(editingSubscriptionId)}
                                onChange={event => setSubscriptionDraft(current => ({ ...current, shopId: event.target.value }))}
                            >
                                {!editingSubscriptionId && <option value="">Use the account's first shop</option>}
                                {subscriptionShopOptions.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                            </select></label>
                            <label>Plan<select
                                value={subscriptionDraft.plan}
                                disabled={subscriptionReadOnly}
                                onChange={event => setSubscriptionDraft(current => ({ ...current, plan: event.target.value }))}
                            >
                                {subscriptionPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                            </select></label>
                            <label>Status<select
                                value={subscriptionDraft.subscriptionStatus}
                                disabled={subscriptionReadOnly}
                                onChange={event => setSubscriptionDraft(current => ({ ...current, subscriptionStatus: event.target.value as SubscriptionStatus }))}
                            ><option>Active</option><option>Paused</option><option>Cancelled</option></select></label>
                            <label>Billing cycle<select
                                value={subscriptionDraft.billingCycle}
                                disabled={subscriptionReadOnly}
                                onChange={event => setSubscriptionDraft(current => ({ ...current, billingCycle: event.target.value as BillingCycle }))}
                            ><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
                            <label>Next billing date<input
                                type="date"
                                value={subscriptionDraft.nextBillingDate}
                                disabled={subscriptionReadOnly}
                                onChange={event => setSubscriptionDraft(current => ({ ...current, nextBillingDate: event.target.value }))}
                            /></label>
                            <div className="oi-admin__subscription-actions">
                                <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={!canSaveSubscription} aria-busy={Boolean(subscriptionBusy)}>
                                    {subscriptionBusy ? "Saving…" : editingSubscriptionId ? "Save changes" : "Create subscription"}
                                </button>
                                {editingSubscriptionId && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={beginSubscriptionCreate}>Cancel</button>}
                            </div>
                        </form>
                        {!editingSubscriptionId && subscriptionDraft.userId && subscriptionShopOptions.length === 0 && <p className="oi-admin__muted">This account has no shop yet. Create a shop before assigning a subscription.</p>}
                        {subscriptionFormError && <p className="oi-form-error">{subscriptionFormError}</p>}
                        {selectedSubscriptionPlan && <div className="oi-admin__notice"><Icon name="shield" size={17} /><p><b>{selectedSubscriptionPlan.name}</b> · {money(subscriptionDraft.billingCycle === "annual" ? selectedSubscriptionPlan.annualPrice : selectedSubscriptionPlan.monthlyPrice)} · {selectedSubscriptionPlan.commission}% commission · {selectedSubscriptionPlan.listingLimit === -1 ? "unlimited listings" : `${selectedSubscriptionPlan.listingLimit} listings`}</p></div>}
                    </section>

                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading">
                            <div><h2>Subscription overview</h2><p>Authoritative shop and account subscription state from the backend.</p></div>
                            <span className="oi-admin__muted">{subscriptionPagination.total} matching</span>
                        </div>
                        <form className="oi-admin__filters" onSubmit={applySubscriptionSearch}>
                            <label>Search<input value={subscriptionSearchInput} onChange={event => setSubscriptionSearchInput(event.target.value)} placeholder="Shop, owner or email" /></label>
                            <label>Status<select value={subscriptionStatusFilter} onChange={event => { setSubscriptionStatusFilter(event.target.value as "ALL" | SubscriptionStatus); setSubscriptionPage(1); }}><option value="ALL">All statuses</option><option>Active</option><option>Paused</option><option>Cancelled</option></select></label>
                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="submit">Search</button>
                        </form>
                        {subscriptions.length ? <div className="oi-admin__table-wrap"><table className="oi-admin__table"><thead><tr><th>Shop</th><th>Account</th><th>Plan</th><th>Status</th><th>Billing</th><th>Next billing</th><th className="oi-seller-table__right">Actions</th></tr></thead><tbody>{subscriptions.map(item => (
                            <tr key={item.id}>
                                <td><b>{item.shopName}</b><small>{item.shopSlug}</small></td>
                                <td>{item.owner ? <><b>{item.owner.name}</b><small>{item.owner.email}</small></> : "—"}</td>
                                <td><b>{item.planName}</b><small>{item.plan}</small></td>
                                <td><span className={`oi-admin__badge ${item.subscriptionStatus === "Active" ? "is-approved" : item.subscriptionStatus === "Paused" ? "is-pending" : "is-rejected"}`}>{item.subscriptionStatus}</span></td>
                                <td>{item.billingCycle ?? "—"}</td>
                                <td>{formatSubscriptionDate(item.nextBillingDate)}</td>
                                <td><div className="oi-admin__row-actions"><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={subscriptionReadOnly} onClick={() => beginSubscriptionEdit(item)}>Edit</button><button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={subscriptionReadOnly || subscriptionBusy === item.shopId} onClick={() => void deleteSubscription(item)}>Delete</button></div></td>
                            </tr>
                        ))}</tbody></table></div> : <p className="oi-admin__muted">No subscriptions match this filter.</p>}
                        <div className="oi-admin__row-actions">
                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={subscriptionPage <= 1} onClick={() => setSubscriptionPage(current => current - 1)}>Previous</button>
                            <span className="oi-admin__muted">Page {subscriptionPagination.page} of {Math.max(subscriptionPagination.pages, 1)}</span>
                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={subscriptionPage >= subscriptionPagination.pages} onClick={() => setSubscriptionPage(current => current + 1)}>Next</button>
                        </div>
                        <div className="oi-admin__plan-note"><Icon name="shield" size={17} /><span>Manual admin changes update subscription metadata only. They do not create payments, settlements or payouts; Paystack-backed purchases remain separately verified.</span></div>
                    </section>
                </>}

                {tab === "reviews" && permissions.canModerate && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Review moderation</h2><p>Pending reviews stay off public pages until approved. Hidden reviews are retained for audit.</p></div><span className="oi-admin__muted">{reviewPagination.total} matching</span></div>
                        <div className="oi-admin__filters">
                            <label>Status<select value={reviewFilter} onChange={event => { setReviewFilter(event.target.value as "ALL" | ReviewStatus); setReviewPage(1); }}><option value="PENDING">Pending</option><option value="VISIBLE">Visible</option><option value="HIDDEN">Hidden</option><option value="ALL">All</option></select></label>
                            <div className="oi-admin__pagination">
                                <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={reviewPagination.page <= 1} onClick={() => setReviewPage(page => Math.max(1, page - 1))}>Previous</button>
                                <span>Page {reviewPagination.page} of {Math.max(1, reviewPagination.pages)}</span>
                                <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={reviewPagination.page >= reviewPagination.pages} onClick={() => setReviewPage(page => page + 1)}>Next</button>
                            </div>
                        </div>
                        {reviews.length ? <div className="oi-admin__review-list">{reviews.map(review => <article className="oi-admin__review-card" key={review.id}>
                            <div className="oi-admin__review-head">
                                <div><b>{review.authorName}</b><span>{review.targetType} · {review.targetName}</span></div>
                                <span className={`oi-admin__badge${review.status === "VISIBLE" ? " is-approved" : review.status === "HIDDEN" ? " is-rejected" : " is-pending"}`}>{review.status.toLowerCase()}</span>
                            </div>
                            <div className="oi-admin__review-meta"><span>{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}</span><span>{new Date(review.createdAt).toLocaleString()}</span></div>
                            <p className="oi-admin__review-text">{review.text}</p>
                            {review.moderationNote && <p className="oi-admin__muted">Moderator note: {review.moderationNote}</p>}
                            <div className="oi-admin__review-actions">
                                <input className="oi-admin__decision-note" aria-label={`Moderation note for review by ${review.authorName}`} value={reviewNotes[review.id] ?? ""} disabled={Boolean(phase9Busy)} placeholder="Optional moderation note" onChange={event => setReviewNotes(current => ({ ...current, [review.id]: event.target.value }))} />
                                <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={phase9Busy === `review-${review.id}`} onClick={() => void moderateReview(review, "VISIBLE")}>Publish</button>
                                <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={phase9Busy === `review-${review.id}`} onClick={() => void moderateReview(review, "PENDING")}>Hold</button>
                                <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={phase9Busy === `review-${review.id}`} onClick={() => void moderateReview(review, "HIDDEN")}>Hide</button>
                                <button className="oi-btn oi-btn--danger oi-btn--sm" type="button" disabled={phase9Busy === `review-${review.id}`} onClick={() => void removeReview(review)}>Delete</button>
                            </div>
                        </article>)}</div> : <p className="oi-admin__muted">No reviews match this filter.</p>}
                    </section>
                </>}

                {tab === "settings" && <section className="oi-admin__panel">
                    <div className="oi-admin__panel-heading"><div><h2>Platform settings</h2><p>Changes take effect immediately in backend behaviour.</p></div></div>
                    <div className="oi-admin__settings-grid">
                        <article className="oi-admin__setting-card">
                            <h3>Commission rate</h3>
                            <p>Applied to sale settlements and seller finance reports.</p>
                            <label className="oi-admin__rate">Commission rate (%)<input type="number" min="0" max="100" step="0.1" disabled={!permissions.canManageFinance} value={commissionRate} onChange={event => saveCommission(event.target.value)} /></label>
                            <p className="oi-admin__muted">{permissions.canManageFinance ? "Financial access is enabled for this account." : "Financial access is required to change this value."}</p>
                        </article>
                        <article className="oi-admin__setting-card">
                            <h3>Review moderation</h3>
                            <p>When enabled, new customer reviews are held as pending until approved.</p>
                            <label className="oi-check"><input type="checkbox" checked={settings?.reviewModeration ?? false} disabled={!settings || !permissions.canModerate || phase9Busy === "review-setting"} onChange={event => void updateReviewSetting(event.target.checked)} /><span>Require approval for new reviews</span></label>
                            <p className="oi-admin__muted">Current behaviour: new reviews are {settings?.reviewModeration ? "held for moderation" : "published immediately"}.</p>
                        </article>
                    </div>
                </section>}

                {tab === "audit" && permissions.canViewAudit && <section className="oi-admin__panel">
                    <div className="oi-admin__panel-heading"><div><h2>Administrative audit log</h2><p>Append-only history of administrative mutations and decisions.</p></div><span className="oi-admin__muted">{auditPagination.total} entries</span></div>
                    <form className="oi-admin__filters" onSubmit={event => { event.preventDefault(); setAuditPage(1); setAuditSearch(auditSearchInput.trim()); }}>
                        <label>Search<input value={auditSearchInput} placeholder="Action or summary" onChange={event => setAuditSearchInput(event.target.value)} /></label>
                        <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit">Apply</button>
                        {auditSearch && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => { setAuditSearch(""); setAuditSearchInput(""); setAuditPage(1); }}>Clear</button>}
                    </form>
                    {auditItems.length ? <div className="oi-admin__table-wrap"><table className="oi-admin__table">
                        <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Summary</th></tr></thead>
                        <tbody>{auditItems.map(item => <tr key={item.id}>
                            <td>{new Date(item.createdAt).toLocaleString()}</td>
                            <td><b>{item.action.replaceAll("_", " ").toLowerCase()}</b></td>
                            <td>{item.actorName}<small>{item.actorRole.toLowerCase()}</small></td>
                            <td>{item.targetType.toLowerCase()}{item.targetId ? <small>{item.targetId}</small> : null}{item.metadata ? <small>{JSON.stringify(item.metadata)}</small> : null}</td>
                            <td>{item.summary}</td>
                        </tr>)}</tbody>
                    </table></div> : <p className="oi-admin__muted">No audit entries match this search.</p>}
                    <div className="oi-admin__pagination">
                        <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={auditPage <= 1} onClick={() => setAuditPage(page => Math.max(1, page - 1))}>Previous</button>
                        <span>Page {auditPagination.page} of {Math.max(1, auditPagination.pages)}</span>
                        <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={auditPage >= auditPagination.pages} onClick={() => setAuditPage(page => page + 1)}>Next</button>
                    </div>
                </section>}

                {tab === "permissions" && permissions.canManageUsers && <section className="oi-admin__panel">
                    <div className="oi-admin__panel-heading"><div><h2>Administrative permissions</h2><p>All administrators can manage users, moderation and audit by default. Financial access is opt-in.</p></div></div>
                    {users.filter(item => item.role === "ADMIN").length ? users.filter(item => item.role === "ADMIN").map(admin => {
                        const view: AdminPermissions = admin.id === user?.id ? permissions : userPermissions[admin.id] ?? { canManageFinance: false, canManageUsers: false, canModerate: false, canViewAudit: false };
                        return <article className="oi-admin__permission-card" key={admin.id}>
                            <div className="oi-admin__permission-head">
                                <div><b>{admin.name}</b><span>{admin.email}</span></div>
                                {admin.id === user?.id && <span className="oi-admin__badge is-approved">This account</span>}
                            </div>
                            <div className="oi-admin__permission-list">{permissionLabels.map(permission => <label className="oi-check" key={permission.key}>
                                <input type="checkbox" checked={view[permission.key]} disabled={Boolean(phase9Busy) || phase9Busy === `permission-${admin.id}-${permission.key}`} onChange={event => void updateUserPermission(admin.id, permission.key, event.target.checked)} />
                                <span><b>{permission.label}</b><small>{permission.detail}</small></span>
                            </label>)}</div>
                            <div className="oi-admin__permission-actions"><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={Boolean(phase9Busy) || phase9Busy === `sessions-${admin.id}`} onClick={() => void revokeSessions(admin.id)}>{phase9Busy === `sessions-${admin.id}` ? "Revoking…" : "Revoke active sessions"}</button></div>
                        </article>;
                    }) : <p className="oi-admin__muted">No administrator accounts are available.</p>}
                </section>}
            </div>
        </div>
    </section>;
}
