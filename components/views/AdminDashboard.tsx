"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
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

type AdminProduct = {
    id?: string;
    dbId?: string;
    name: string;
    price: string;
    size: string;
    stock: string;
    status?: "Active" | "Draft" | "Out of stock";
    category?: string;
    description?: string;
    imageUrl?: string | null;
};
type AdminShop = Omit<DatabaseShop, "name" | "status" | "products"> & {
    name: string;
    shop: string;
    status?: "Active" | "Paused";
    shopStatus?: "Active" | "Paused";
    verificationRequestedAt?: string | null;
    products: AdminProduct[];
};
type Tab = "overview" | "users" | "sellers" | "products" | "orders" | "payments" | "finance" | "subscriptions";
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
type Settlement = { id: string; amount: number; date: string; status: "Recorded locally" };
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
const tabs: { id: Tab; label: string; icon: "grid" | "shield" | "store" | "box" | "receipt" | "lock" | "wallet" | "sparkle" }[] = [
    { id: "overview", label: "Overview", icon: "grid" }, { id: "users", label: "Users & roles", icon: "shield" }, { id: "sellers", label: "Seller verification", icon: "store" },
    { id: "products", label: "Shops & products", icon: "box" }, { id: "orders", label: "Orders", icon: "receipt" },
    { id: "payments", label: "Payments", icon: "lock" },
    { id: "finance", label: "Commission & settlements", icon: "wallet" }, { id: "subscriptions", label: "Subscriptions", icon: "sparkle" },
];

function money(value: number) { return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`; }

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
        void readBackendData<{ shops: AdminShop[]; categories: Category[]; orders: CustomerOrder[]; payments: PaymentState; paymentRecords: PaymentRecord[]; refundRecords: PaymentRefundRecord[]; settlements: Settlement[]; settings: { commissionRate: number } }>("admin")
            .then(data => { if (!cancelled) { const records = data.shops.map(record => ({ ...record, shop: record.name, shopStatus: (record.status === "Paused" ? "Paused" : "Active") as AdminShop["shopStatus"] })); setShops(records); setSelectedShopSlug(records[0]?.slug ?? ""); setCategories(data.categories ?? []); setOrders(data.orders); setPayments(data.payments); setPaymentRecords(data.paymentRecords ?? []); setRefundRecords(data.refundRecords ?? []); setSettlements(data.settlements); setCommissionRate(String((data.settings.commissionRate ?? 0) * 100)); } })
            .catch(error => console.error("Admin data could not be loaded", error))
            .finally(() => { if (!cancelled) setReady(true); });
        return () => { cancelled = true; };
    }, [authReady, user, router]);

    useEffect(() => {
        if (!authReady || user?.role !== "admin") return;
        let cancelled = false;
        void apiFetch<{ items: AdminUser[] }>("/admin/users?limit=100")
            .then(data => { if (!cancelled) setUsers(data.items); })
            .catch(error => { if (!cancelled) setUserError(error instanceof Error ? error.message : "Could not load users."); });
        return () => { cancelled = true; };
    }, [authReady, user]);

    async function saveShop(next: AdminShop) {
        const updated = next.shopStatus === "Paused" || !next.verified ? { ...next, published: false } : next;
        setShops(current => current.map(item => item.slug === updated.slug ? updated : item));
        const { shop: label, shopStatus, ...fields } = updated;
        const record = { ...fields, name: label, status: shopStatus ?? "Active" };
        try {
            await mutateBackendData("admin-upsert-shop", { shop: record });
            await refreshMarketplace();
            setAdminError("");
            setAdminNotice("Shop controls updated.");
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not update this shop."); }
    }

    async function saveProductStatus(shop: AdminShop, product: AdminProduct, status: NonNullable<AdminProduct["status"]>) {
        setShops(current => current.map(item => item.slug === shop.slug
            ? { ...item, products: item.products.map(row => row.id === product.id || row.dbId === product.dbId ? { ...row, status } : row) }
            : item));
        try {
            await mutateBackendData("admin-set-product-status", { id: product.dbId ?? product.id, product: { ...product, status } });
            await refreshMarketplace();
            setAdminError("");
            setAdminNotice("Product status updated.");
        } catch (error) { setAdminError(error instanceof Error ? error.message : "Could not update this product."); }
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
        if (orderBusy) return;
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
        if (orderBusy) return;
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

    function saveCommission(value: string) {
        setCommissionRate(value); void mutateBackendData("set-settings", { settings: { commissionRate: Number(value) || 0 } })
            .then(() => void loadFinance())
            .catch(error => { setAdminError(error instanceof Error ? error.message : "Could not update the commission rate."); });
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
        if (!editingCategoryId) return;
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
        setUserError("");
        try {
            const updated = await apiFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
            setUsers(current => current.map(item => item.id === id ? { ...item, ...updated } : item));
            setUserNotice("User updated.");
        } catch (error) { setUserError(error instanceof Error ? error.message : "Could not update this user."); }
    }

    async function createUser(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
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
        setUserError("");
        try {
            const result = await apiFetch<{ devToken?: string }>(`/admin/users/${id}/send-password-reset`, { method: "POST" });
            setUserNotice(result.devToken ? "Reset link ready in development mode." : "Password reset email sent.");
        } catch (error) { setUserError(error instanceof Error ? error.message : "Could not send a reset link."); }
    }

    if (!authReady || !ready || !user || user.role !== "admin") return <LoadingState label="Checking administrator access" />;
    const shop = shops.find(item => item.slug === selectedShopSlug) ?? shops[0] ?? null;
    const title = tabs.find(item => item.id === tab)?.label ?? "Overview";

    return <section className="oi-view oi-container oi-admin">
        <div className="oi-dashboard oi-admin__layout">
            <aside className="oi-sidebar">
                <div className="oi-sidebar__brand"><Logo size="sm" alt="Oilinga" /></div>
                <small className="oi-sidebar__label">ADMINISTRATION</small>
                <nav className="oi-sidebar__nav" aria-label="Admin navigation">{tabs.map(item => <button key={item.id} type="button" className={`oi-sidebar__link${tab === item.id ? " is-active" : ""}`} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><Icon name={item.icon} size={16} />{item.label}</button>)}</nav>
                <div className="oi-sidebar__profile"><span className="oi-avatar">AD</span><div className="oi-sidebar__profile-text"><b className="oi-sidebar__profile-name">Admin workspace</b><small className="oi-sidebar__profile-meta">Local prototype</small></div></div>
            </aside>
            <div className="oi-dashboard__content oi-admin__content">
                <header className="oi-admin__header"><div><span className="oi-eyebrow oi-eyebrow--green">OILINGA ADMIN</span><h1>{title}</h1><p>Review shop operations and marketplace records.</p></div><Link className="oi-btn oi-btn--outline" href="/">View marketplace <Icon name="arrow-right" size={15} /></Link></header>
                <div className="oi-admin__notice"><Icon name="shield" size={17} /><p>Administrator access is role-gated, and seller verification is managed here. Card payments are processed by Paystack; settlements and subscription billing remain local records.</p></div>
                {adminError && <p className="oi-form-error" role="alert">{adminError}</p>}
                {adminNotice && <p className="oi-admin__muted" role="status">{adminNotice}</p>}

                {tab === "overview" && <>
                    <div className="oi-admin__metrics"><article><span>Registered shops</span><strong>{shops.length}</strong></article><article><span>Awaiting verification</span><strong>{shops.filter(item => !item.verified).length}</strong></article><article><span>Products</span><strong>{shops.reduce((count, item) => count + item.products.length, 0)}</strong></article><article><span>Orders</span><strong>{orders.length}</strong></article><article><span>Gross sales</span><strong>{money(financeReport?.totals.grossSales ?? 0)}</strong></article><article><span>Available balance</span><strong>{money(financeReport?.totals.availableBalance ?? 0)}</strong></article></div>
                    <section className="oi-admin__panel"><h2>Needs attention</h2>{shops.filter(item => !item.verified).length ? shops.filter(item => !item.verified).map(item => <div className="oi-admin__attention" key={item.slug}><div><b>{item.shop}</b><span>{item.owner} · {item.location}</span></div><button className="oi-btn oi-btn--primary oi-btn--sm" type="button" onClick={() => { setSelectedShopSlug(item.slug); setTab("sellers"); }}>Review seller</button></div>) : <p className="oi-admin__muted">No seller verification is pending.</p>}{orders.length === 0 && <p className="oi-admin__muted">There are no local order records yet.</p>}</section>
                </>}

                {tab === "users" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Accounts and roles</h2><p>Manage customer, seller and administrator access.</p></div></div>
                        {userError && <p className="oi-form-error" role="alert">{userError}</p>}
                        {userNotice && <p className="oi-admin__muted" role="status">{userNotice}</p>}
                        <div className="oi-admin__table-wrap">
                            <table className="oi-admin__table"><thead><tr><th>User</th><th>Role</th><th>Email</th><th>Status</th><th>Recovery</th></tr></thead><tbody>
                                {users.map(item => <tr key={item.id}>
                                    <td><b>{item.name}</b><small>{item.emailVerifiedAt ? "Email verified" : "Email unverified"}</small></td>
                                    <td><select aria-label={`Role for ${item.email}`} value={item.role} onChange={event => saveUser(item.id, { role: event.target.value as AdminRole })}><option>CUSTOMER</option><option>SELLER</option><option>ADMIN</option></select></td>
                                    <td>{item.email}</td>
                                    <td><select aria-label={`Status for ${item.email}`} value={item.status} onChange={event => saveUser(item.id, { status: event.target.value as AdminUser["status"] })}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></td>
                                    <td><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => sendPasswordReset(item.id)}>Send reset</button></td>
                                </tr>)}
                            </tbody></table>
                            {users.length === 0 && <p className="oi-admin__muted">No accounts found.</p>}
                        </div>
                    </section>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Provision an account</h2><p>Create a customer, seller or administrator account with a hashed password.</p></div></div>
                        <form className="oi-admin__category-form" onSubmit={createUser}>
                            <label>Full name<input required value={newUser.name} onChange={event => setNewUser({ ...newUser, name: event.target.value })} placeholder="Amina Okafor" /></label>
                            <label>Email address<input required type="email" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} placeholder="amina@example.com" /></label>
                            <label>Temporary password<input required type="password" minLength={12} value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} placeholder="At least 12 characters" /></label>
                            <label>Role<select value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value as AdminRole })}><option>CUSTOMER</option><option>SELLER</option><option>ADMIN</option></select></label>
                            <label className="oi-check"><input type="checkbox" checked={newUser.emailVerified} onChange={event => setNewUser({ ...newUser, emailVerified: event.target.checked })} /><span>Mark this email as verified</span></label>
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit">Create account</button>
                        </form>
                    </section>
                </>}

                {tab === "sellers" && <section className="oi-admin__panel">
                    <div className="oi-admin__panel-heading"><div><h2>Seller applications</h2><p>Verify shop profiles before sellers can publish. Pausing a shop also unpublishes it.</p></div></div>
                    {shops.length ? shops.map(item => <article className="oi-admin__seller-card" key={item.slug}>
                        <div className="oi-admin__seller-avatar">{item.shop.slice(0, 2).toUpperCase()}</div>
                        <div className="oi-admin__seller-main"><h3>{item.shop}</h3><p>{item.owner} · {item.location}</p><small>{item.tagline || "No shop introduction provided."}</small>{item.verificationRequestedAt && <small>Requested {new Date(item.verificationRequestedAt).toLocaleDateString()}</small>}</div>
                        <span className={`oi-admin__badge${item.verified ? " is-approved" : ""}`}>{item.verified ? "Verified" : "Pending review"}</span>
                        <div className="oi-admin__seller-actions">
                            <label>Status<select aria-label={`Status for ${item.shop}`} value={item.shopStatus ?? "Active"} onChange={event => void saveShop({ ...item, shopStatus: event.target.value as AdminShop["shopStatus"] })}><option>Active</option><option>Paused</option></select></label>
                            {item.published && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => void saveShop({ ...item, published: false })}>Unpublish</button>}
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" onClick={() => void saveShop({ ...item, verified: !item.verified, published: item.verified ? false : item.published })}>{item.verified ? "Revoke verification" : "Verify seller"}</button>
                        </div>
                    </article>) : <p className="oi-admin__muted">No seller shops have been registered.</p>}
                </section>}

                {tab === "products" && <>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Product categories</h2><p>Manage the categories sellers can choose when they add products.</p></div></div>
                        <div className="oi-admin__category-list">{categories.map(category => editingCategoryId === category.id
                            ? <form className="oi-admin__category-chip oi-admin__category-chip--editing" key={category.id} onSubmit={saveCategory}>
                                <label>Name<input required value={categoryDraft.name} onChange={event => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></label>
                                <label>Description<input value={categoryDraft.caption} onChange={event => setCategoryDraft({ ...categoryDraft, caption: event.target.value })} /></label>
                                <label>Icon<input maxLength={8} value={categoryDraft.glyph} onChange={event => setCategoryDraft({ ...categoryDraft, glyph: event.target.value })} /></label>
                                <div className="oi-admin__category-actions"><button className="oi-btn oi-btn--primary oi-btn--sm" type="submit">Save</button><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => setEditingCategoryId("")}>Cancel</button></div>
                            </form>
                            : <div className="oi-admin__category-chip" key={category.id}>
                                <span aria-hidden="true">{category.glyph}</span><b>{category.name}</b><small>{category.caption}</small><small>{category.id}</small>
                                <div className="oi-admin__category-actions"><button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => beginCategoryEdit(category)}>Edit</button><button className="oi-btn oi-btn--danger oi-btn--sm" type="button" onClick={() => void deleteCategory(category.id)}>Delete</button></div>
                            </div>)}</div>
                        <form className="oi-admin__category-form" onSubmit={addCategory}>
                            <label>Category name<input required value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="e.g. Shea Oil" /></label>
                            <label>Description<input value={categoryCaption} onChange={event => setCategoryCaption(event.target.value)} placeholder="Short category description" /></label>
                            <label>Icon<input value={categoryGlyph} onChange={event => setCategoryGlyph(event.target.value)} maxLength={8} placeholder="🫙" /></label>
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit">Add category</button>
                        </form>
                        {categoryError && <p className="oi-form-error" role="alert">{categoryError}</p>}
                    </section>
                    <section className="oi-admin__panel">
                        <div className="oi-admin__panel-heading"><div><h2>Shop and product management</h2><p>Pause a storefront or change individual listing status. Changes write to the catalogue immediately.</p></div>{shops.length > 1 && <label className="oi-admin__rate">Select shop<select value={shop?.slug ?? ""} onChange={event => setSelectedShopSlug(event.target.value)}>{shops.map(item => <option key={item.slug} value={item.slug}>{item.shop}</option>)}</select></label>}</div>
                        {shop ? <>
                            <div className="oi-admin__shop-control">
                                <div><b>{shop.shop}</b><span>{shop.location} · {shop.verified ? "Verified" : "Unverified"} · {shop.published ? "Published" : "Unpublished"}</span></div>
                                <div className="oi-admin__shop-actions">
                                    {shop.published && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" onClick={() => void saveShop({ ...shop, published: false })}>Unpublish</button>}
                                    <label>Shop status<select value={shop.shopStatus ?? "Active"} onChange={event => void saveShop({ ...shop, shopStatus: event.target.value as AdminShop["shopStatus"] })}><option>Active</option><option>Paused</option></select></label>
                                </div>
                            </div>
                            <div className="oi-admin__table-wrap">
                                <table className="oi-admin__table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Listing status</th></tr></thead><tbody>
                                    {shop.products.map((item, index) => <tr key={item.dbId ?? item.id ?? `${item.name}-${index}`}>
                                        <td><div className="oi-admin__product-cell">{item.imageUrl && <img src={item.imageUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} />}<div><b>{item.name}</b><small>{item.size}{item.category ? ` · ${item.category}` : ""}</small></div></div></td>
                                        <td>{money(Number(item.price) || 0)}</td>
                                        <td>{item.stock}</td>
                                        <td><select aria-label={`${item.name} listing status`} value={item.status ?? "Active"} onChange={event => void saveProductStatus(shop, item, event.target.value as NonNullable<AdminProduct["status"]>)}><option>Active</option><option>Draft</option><option>Out of stock</option></select></td>
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
                                                                disabled={busy}
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
                                <button type="button" className="oi-btn oi-btn--outline oi-btn--sm" onClick={() => void reconcilePayments()} disabled={reconcileBusy}>
                                    <Icon name="shield" size={15} /> {reconcileBusy ? "Reconciling…" : "Reconcile with Paystack"}
                                </button>
                            </div>

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
                                                            <button type="button" className="oi-btn oi-btn--outline oi-btn--sm" disabled={orderBusy === payment.reference} onClick={() => void verifyPaymentRecord(payment.reference)}>
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
                        <div className="oi-admin__panel-heading"><div><h2>Platform finance</h2><p>Live figures from order lines, payments, payouts and settlements.</p></div><label className="oi-admin__rate">Commission rate (%)<input type="number" min="0" max="100" step="0.1" value={commissionRate} onChange={event => saveCommission(event.target.value)} /></label></div>
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
                                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={financeBusy === payout.id} onClick={() => void processPayout(payout.id, "approve-payout")}>Approve</button>
                                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={financeBusy === payout.id} onClick={() => void processPayout(payout.id, "reject-payout")}>Reject</button>
                                        </>}
                                        {(payout.status === "APPROVED" || payout.status === "PROCESSING") && <>
                                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={financeBusy === payout.id} onClick={() => void processPayout(payout.id, "mark-payout-paid")}>Mark paid</button>
                                            <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={financeBusy === payout.id} onClick={() => void processPayout(payout.id, "fail-payout")}>Fail</button>
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
                            <label>Shop<select value={adjustment.shopId} onChange={event => setAdjustment({ ...adjustment, shopId: event.target.value })}><option value="">Select a shop</option>{shops.map(item => <option key={item.id} value={item.id}>{item.shop}</option>)}</select></label>
                            <label>Amount (₦)<input type="number" min="1" step="0.01" value={adjustment.amount} onChange={event => setAdjustment({ ...adjustment, amount: event.target.value })} /></label>
                            <label>Unique reference<input type="text" value={adjustment.reference} onChange={event => setAdjustment({ ...adjustment, reference: event.target.value })} placeholder="ADJ-2026-001" /></label>
                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="submit" disabled={financeBusy === "adjustment"}>Record adjustment</button>
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

                {tab === "subscriptions" && <section className="oi-admin__panel"><div className="oi-admin__panel-heading"><div><h2>Subscription management</h2><p>Subscription billing is not connected; changes here are local status records.</p></div></div>{shops.length ? shops.map(item => <div className="oi-admin__shop-control" key={item.slug}><div><b>{item.shop}</b><span>Plan: {item.plan ?? "Free"}</span></div><label>Subscription status<select value={item.subscriptionStatus ?? "Active"} onChange={event => saveShop({ ...item, subscriptionStatus: event.target.value as AdminShop["subscriptionStatus"] })}><option>Active</option><option>Paused</option><option>Cancelled</option></select></label></div>) : <p className="oi-admin__muted">No subscriptions are registered.</p>}<div className="oi-admin__plan-note"><Icon name="shield" size={17} /><span>Plan pricing, recurring charges and invoices need a billing provider before they can be administered here.</span></div></section>}
            </div>
        </div>
    </section>;
}
