"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import type { CustomerOrder, OrderStatusKey } from "@/lib/types";
import { ORDER_TRANSITIONS } from "@/lib/types";
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
type Tab = "overview" | "users" | "sellers" | "products" | "orders" | "finance" | "subscriptions";
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
const tabs: { id: Tab; label: string; icon: "grid" | "shield" | "store" | "box" | "receipt" | "wallet" | "sparkle" }[] = [
    { id: "overview", label: "Overview", icon: "grid" }, { id: "users", label: "Users & roles", icon: "shield" }, { id: "sellers", label: "Seller verification", icon: "store" },
    { id: "products", label: "Shops & products", icon: "box" }, { id: "orders", label: "Orders & payments", icon: "receipt" },
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
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [commissionRate, setCommissionRate] = useState("0");
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
        void readBackendData<{ shops: AdminShop[]; categories: Category[]; orders: CustomerOrder[]; payments: PaymentState; settlements: Settlement[]; settings: { commissionRate: number } }>("admin")
            .then(data => { if (!cancelled) { const records = data.shops.map(record => ({ ...record, shop: record.name, shopStatus: (record.status === "Paused" ? "Paused" : "Active") as AdminShop["shopStatus"] })); setShops(records); setSelectedShopSlug(records[0]?.slug ?? ""); setCategories(data.categories ?? []); setOrders(data.orders); setPayments(data.payments); setSettlements(data.settlements); setCommissionRate(String(data.settings.commissionRate ?? 0)); } })
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
            const data = await readBackendData<{ orders: CustomerOrder[]; payments: PaymentState }>("admin");
            setOrders(data.orders);
            setPayments(data.payments);
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
    function saveCommission(value: string) {
        setCommissionRate(value); void mutateBackendData("set-settings", { settings: { commissionRate: Number(value) || 0 } }).catch(error => console.error("Commission setting update failed", error));
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
    const deliveredGross = orders.filter(order => order.status === "Delivered").reduce((sum, order) => sum + order.subtotal, 0);
    const rate = Math.max(0, Number(commissionRate) || 0);
    const commission = deliveredGross * rate / 100;
    const settled = settlements.reduce((sum, item) => sum + item.amount, 0);
    const unsettled = Math.max(0, deliveredGross - commission - settled);
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
                <div className="oi-admin__notice"><Icon name="shield" size={17} /><p>Administrator access is role-gated, and seller verification is managed here. Payment processing, settlements and subscription billing are not live.</p></div>
                {adminError && <p className="oi-form-error" role="alert">{adminError}</p>}
                {adminNotice && <p className="oi-admin__muted" role="status">{adminNotice}</p>}

                {tab === "overview" && <>
                    <div className="oi-admin__metrics"><article><span>Registered shops</span><strong>{shops.length}</strong></article><article><span>Awaiting verification</span><strong>{shops.filter(item => !item.verified).length}</strong></article><article><span>Products</span><strong>{shops.reduce((count, item) => count + item.products.length, 0)}</strong></article><article><span>Orders</span><strong>{orders.length}</strong></article><article><span>Delivered order value</span><strong>{money(deliveredGross)}</strong></article><article><span>Settlement estimate</span><strong>{money(unsettled)}</strong></article></div>
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
                                                        <select
                                                            aria-label={`Payment status for ${order.id}`}
                                                            value={payments[order.id] ?? "Pending"}
                                                            disabled={busy}
                                                            onChange={event => void setPayment(order.id, event.target.value as PaymentState[string])}
                                                        >
                                                            {["Pending", "Confirmed", "Failed", "Refunded"].map(status => <option key={status}>{status}</option>)}
                                                        </select>
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

                {tab === "finance" && <><section className="oi-admin__panel"><div className="oi-admin__panel-heading"><div><h2>Commission and settlements</h2><p>Estimate fees from delivered order records.</p></div><label className="oi-admin__rate">Commission rate (%)<input type="number" min="0" max="100" step="0.1" value={commissionRate} onChange={event => saveCommission(event.target.value)} /></label></div><div className="oi-admin__metrics oi-admin__metrics--finance"><article><span>Delivered order value</span><strong>{money(deliveredGross)}</strong></article><article><span>Estimated commission</span><strong>{money(commission)}</strong></article><article><span>Estimated seller balance</span><strong>{money(Math.max(0, deliveredGross - commission))}</strong></article><article><span>Unsettled estimate</span><strong>{money(unsettled)}</strong></article></div><button className="oi-btn oi-btn--primary" type="button" disabled={unsettled <= 0} onClick={() => { const settlement = { id: `SET-${Date.now()}`, amount: unsettled, date: new Date().toISOString(), status: "Recorded locally" as const }; setSettlements([settlement, ...settlements]); void mutateBackendData("create-settlement", { settlement }).catch(error => console.error("Settlement record failed", error)); }}>Record settlement</button><p className="oi-admin__muted">This records an admin note only. It does not move money or initiate a payout.</p></section><section className="oi-admin__panel"><h2>Settlement records</h2>{settlements.length ? settlements.map(item => <div className="oi-admin__attention" key={item.id}><div><b>{item.id}</b><span>{new Date(item.date).toLocaleString()}</span></div><strong>{money(item.amount)}</strong><span className="oi-admin__badge">{item.status}</span></div>) : <p className="oi-admin__muted">No settlement records.</p>}</section></>}

                {tab === "subscriptions" && <section className="oi-admin__panel"><div className="oi-admin__panel-heading"><div><h2>Subscription management</h2><p>Subscription billing is not connected; changes here are local status records.</p></div></div>{shops.length ? shops.map(item => <div className="oi-admin__shop-control" key={item.slug}><div><b>{item.shop}</b><span>Plan: {item.plan ?? "Free"}</span></div><label>Subscription status<select value={item.subscriptionStatus ?? "Active"} onChange={event => saveShop({ ...item, subscriptionStatus: event.target.value as AdminShop["subscriptionStatus"] })}><option>Active</option><option>Paused</option><option>Cancelled</option></select></label></div>) : <p className="oi-admin__muted">No subscriptions are registered.</p>}<div className="oi-admin__plan-note"><Icon name="shield" size={17} /><span>Plan pricing, recurring charges and invoices need a billing provider before they can be administered here.</span></div></section>}
            </div>
        </div>
    </section>;
}
