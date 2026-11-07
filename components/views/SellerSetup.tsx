"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";

type Listing = {
    id: string;
    name: string;
    price: string;
    size: string;
    stock: string;
    status: "Active" | "Draft";
};
type SellerOrder = {
    id: string;
    customer: string;
    createdAt: string;
    total: number;
    status: "New" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
    items: { productId: string; name: string; quantity: number }[];
};
type ShopSetup = {
    shop: string;
    owner: string;
    location: string;
    tagline: string;
    products: Listing[];
    orders: SellerOrder[];
    plan: "Free";
    published: boolean;
};
type Stage = "landing" | "register" | "products" | "dashboard";
type WorkspaceTab = "overview" | "products" | "inventory" | "orders" | "earnings" | "subscription" | "settings";

const STORAGE_KEY = "oilinga-seller-shop-v1";
const blankProduct = { name: "", price: "", size: "", stock: "" };
const workspaceTabs: { id: WorkspaceTab; label: string; icon: "grid" | "box" | "archive" | "receipt" | "wallet" | "sparkle" | "settings" }[] = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "products", label: "Products", icon: "box" },
    { id: "inventory", label: "Inventory", icon: "archive" },
    { id: "orders", label: "Orders", icon: "receipt" },
    { id: "earnings", label: "Earnings", icon: "wallet" },
    { id: "subscription", label: "Subscription", icon: "sparkle" },
    { id: "settings", label: "Shop settings", icon: "settings" },
];
const steps = [
    { number: "01", title: "Register your shop", copy: "Add your business name, owner details and location." },
    { number: "02", title: "List your products", copy: "Set product names, pack sizes, prices and available stock." },
    { number: "03", title: "Publish and grow", copy: "Publish your products and manage your shop from one place." },
];

export function SellerSetup() {
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

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const raw = JSON.parse(saved) as Partial<ShopSetup> & Pick<ShopSetup, "shop" | "owner" | "location" | "tagline" | "published">;
                const existing: ShopSetup = {
                    ...raw,
                    products: (raw.products ?? []).map((item, index) => ({
                        ...item,
                        id: item.id || `product-${index + 1}`,
                        status: item.status ?? (raw.published ? "Active" : "Draft"),
                    })),
                    orders: raw.orders ?? [],
                    plan: raw.plan ?? "Free",
                };
                setSetup(existing);
                setStage(existing.published ? "dashboard" : "products");
            }
        } catch {
            // Start at the landing page if saved browser data is unreadable.
        }
        setLoaded(true);
    }, []);

    function save(value: ShopSetup) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        setSetup(value);
    }

    function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!shop.trim() || !owner.trim() || !location.trim()) return;
        save({
            shop: shop.trim(),
            owner: owner.trim(),
            location: location.trim(),
            tagline: tagline.trim(),
            products: [],
            orders: [],
            plan: "Free",
            published: false,
        });
        setError("");
        setStage("products");
    }

    function addProduct(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (
            !setup ||
            !product.name.trim() ||
            Number(product.price) <= 0 ||
            !product.size.trim() ||
            Number(product.stock) < 0
        ) {
            setError("Enter a product name, size, positive price and stock quantity.");
            return false;
        }
        save({
            ...setup,
            products: [...setup.products, {
                ...product,
                id: `product-${Date.now()}`,
                name: product.name.trim(),
                status: setup.published ? "Active" : "Draft",
            }],
        });
        setProduct(blankProduct);
        setError("");
        return true;
    }

    function publishShop() {
        if (!setup?.products.length) return;
        save({
            ...setup,
            published: true,
            products: setup.products.map((item) => ({ ...item, status: "Active" })),
        });
        setStage("dashboard");
    }

    function updateProduct(productId: string, patch: Partial<Listing>) {
        if (!setup) return;
        save({
            ...setup,
            products: setup.products.map((item) => item.id === productId ? { ...item, ...patch } : item),
        });
    }

    function updateOrderStatus(orderId: string, status: SellerOrder["status"]) {
        if (!setup) return;
        save({
            ...setup,
            orders: setup.orders.map((order) => order.id === orderId ? { ...order, status } : order),
        });
    }

    function formatMoney(value: number) {
        return `₦${value.toLocaleString("en-NG")}`;
    }

    function productRow(item: Listing) {
        return (
            <article className="oi-seller-dashboard__product" key={item.id}>
                <span className="oi-seller-dashboard__product-icon"><Icon name="package" size={19} /></span>
                <div className="oi-seller-dashboard__product-info">
                    <h3>{item.name}</h3><p>{item.size}</p>
                </div>
                <strong>{formatMoney(Number(item.price))}</strong>
                <span className={`oi-seller-dashboard__status oi-seller-dashboard__status--${item.status.toLowerCase()}`}>{item.status}</span>
                <label className="oi-seller-dashboard__stock">Stock
                    <input aria-label={`${item.name} stock quantity`} type="number" min="0" value={item.stock} onChange={e => updateProduct(item.id, { stock: e.target.value })} />
                </label>
                <button className="oi-seller-dashboard__text-button" type="button" onClick={() => updateProduct(item.id, { status: item.status === "Active" ? "Draft" : "Active" })}>{item.status === "Active" ? "Pause listing" : "Activate"}</button>
            </article>
        );
    }

    if (!loaded) {
        return <section className="oi-view oi-container"><p>Loading your shop…</p></section>;
    }

    if (stage === "landing") {
        return (
            <section className="oi-view oi-container oi-seller-landing">
                <div className="oi-hero oi-seller-landing__hero">
                    <div className="oi-hero__copy oi-seller-landing__copy">
                        <span className="oi-eyebrow">SELL ON OILINGA</span>
                        <h1 className="oi-hero__title">Your harvest deserves a <em>bigger market.</em></h1>
                        <p className="oi-hero__lede">
                            Open a shop, list your oils and reach buyers looking for trusted local producers.
                        </p>
                        <div className="oi-hero__actions">
                            <button className="oi-btn oi-btn--gold" type="button" onClick={() => setStage("register")}>
                                Create your shop <Icon name="arrow-right" size={16} />
                            </button>
                            <a className="oi-btn oi-btn--glass" href="#seller-how-it-works">How it works</a>
                        </div>
                        <div className="oi-hero__proof">
                            <span>✦ Free to get started</span>
                            <span>✦ Set up in a few steps</span>
                        </div>
                    </div>
                    <div className="oi-hero__photo oi-seller-landing__photo" aria-hidden="true">
                        <img src="/assets/brand/oilinga-brand-visual-reference.png" alt="" />
                    </div>
                </div>

                <div id="seller-how-it-works" className="oi-seller-landing__how">
                    <div className="oi-section__head">
                        <div>
                            <span className="oi-eyebrow oi-eyebrow--green">A SIMPLE WAY TO START</span>
                            <h2 className="oi-section__title">From producer to storefront</h2>
                        </div>
                    </div>
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

                <section className="oi-seller-landing__callout">
                    <div>
                        <span className="oi-eyebrow">READY WHEN YOU ARE</span>
                        <h2>Let’s get your shop started.</h2>
                        <p>Register your business first. You can add products and publish once your shop details are in.</p>
                    </div>
                    <button className="oi-btn oi-btn--gold" type="button" onClick={() => setStage("register")}>
                        Create your shop <Icon name="arrow-right" size={16} />
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
                        <button className="oi-btn oi-btn--primary" type="submit">Register and continue <Icon name="arrow-right" size={16} /></button>
                    </form>
                </div>
            </section>
        );
    }

    if (stage === "products" && setup) {
        return (
            <section className="oi-view oi-container oi-seller-setup">
                <div className="oi-seller-setup__card">
                    <span className="oi-eyebrow oi-eyebrow--green">STEP 2 OF 3 · PRODUCT LISTING</span>
                    <h1 className="oi-seller-setup__title">Add products to {setup.shop}</h1>
                    <p className="oi-seller-setup__lede">Your shop is registered. Add at least one product before publishing your storefront.</p>
                    <div className="oi-seller-setup__steps"><b>Shop registered</b><span>→ Add products → Publish</span></div>
                    <form onSubmit={addProduct}>
                        <label className="oi-seller-setup__field">Product name<input required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} placeholder="Cold-pressed palm oil" /></label>
                        <div className="oi-seller-setup__product-fields">
                            <label className="oi-seller-setup__field">Price (₦)<input required type="number" min="1" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></label>
                            <label className="oi-seller-setup__field">Pack size<input required value={product.size} onChange={e => setProduct({ ...product, size: e.target.value })} placeholder="5 litres" /></label>
                            <label className="oi-seller-setup__field">Stock quantity<input required type="number" min="0" value={product.stock} onChange={e => setProduct({ ...product, stock: e.target.value })} /></label>
                        </div>
                        {error && <p role="alert" className="oi-seller-setup__error">{error}</p>}
                        <button className="oi-btn oi-btn--outline" type="submit">Add product</button>
                    </form>
                    <h2 className="oi-seller-setup__products-title">Products ({setup.products.length})</h2>
                    {setup.products.length === 0 ? (
                        <p className="oi-seller-setup__empty">No products listed yet.</p>
                    ) : (
                        <ul className="oi-seller-setup__products">
                            {setup.products.map((item, index) => (
                                <li key={`${item.name}-${index}`}>
                                    <b>{item.name}</b><span>₦{Number(item.price).toLocaleString()} · {item.size} · {item.stock} in stock</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <button className="oi-btn oi-btn--primary" type="button" disabled={!setup.products.length} onClick={publishShop}>
                        Publish shop and products <Icon name="arrow-right" size={16} />
                    </button>
                </div>
            </section>
        );
    }

    if (stage === "dashboard" && setup?.published) {
        const inventory = setup.products.reduce((total, item) => total + Number(item.stock || 0), 0);
        const delivered = setup.orders.filter(order => order.status === "Delivered").reduce((total, order) => total + order.total, 0);
        const pending = setup.orders.filter(order => order.status !== "Delivered" && order.status !== "Cancelled").reduce((total, order) => total + order.total, 0);
        const tabTitle = workspaceTabs.find(tab => tab.id === activeTab)?.label ?? "Overview";
        const shopSlug = setup.shop.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return (
            <section className="oi-view oi-container oi-seller-dashboard">
              <div className="oi-dashboard">
              <aside className="oi-sidebar">
                    <div className="oi-sidebar__brand"><Logo size="sm" alt="Oilinga" /></div>
                    <small className="oi-sidebar__label">SELLER PORTAL</small>
                    <nav className="oi-sidebar__nav" aria-label="Seller workspace">
                        {workspaceTabs.map(tab => <button key={tab.id} type="button" className={`oi-sidebar__link${activeTab === tab.id ? " is-active" : ""}`} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}><Icon name={tab.icon} size={17} />{tab.label}</button>)}
                    </nav>
                    <div className="oi-sidebar__profile"><span className="oi-avatar">{setup.owner.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="oi-sidebar__profile-text"><b className="oi-sidebar__profile-name">{setup.shop}</b><small className="oi-sidebar__profile-meta">Seller account</small></div></div>
              </aside>
              <div className="oi-dashboard__content oi-seller-dashboard__content">
                <div className="oi-seller-dashboard__heading">
                    <div>
                        <span className="oi-eyebrow oi-eyebrow--green">SELLER DASHBOARD</span>
                        <h1>{setup.shop}</h1>
                        <p>{setup.location}{setup.tagline ? ` · ${setup.tagline}` : ""}</p>
                    </div>
                    <Link className="oi-seller-dashboard__live" href={`/shops/${shopSlug}`}><span /> View storefront</Link>
                </div>
                <div className="oi-seller-dashboard__workspace">
                    <div className="oi-seller-dashboard__workspace-head"><div><span className="oi-eyebrow oi-eyebrow--green">SHOP WORKSPACE</span><h2>{tabTitle}</h2></div>{activeTab === "products" && <button className="oi-btn oi-btn--primary" type="button" onClick={() => setProductFormOpen(!productFormOpen)}>{productFormOpen ? "Close form" : "Add product"}</button>}</div>
                    {activeTab === "overview" && <>
                        <div className="oi-seller-dashboard__metrics">
                            <article><span>Products</span><strong>{setup.products.length}</strong><small>In your catalogue</small></article>
                            <article><span>Units in stock</span><strong>{inventory}</strong><small>Across all products</small></article>
                            <article><span>Orders</span><strong>{setup.orders.length}</strong><small>Received by your shop</small></article>
                            <article><span>Delivered sales</span><strong>{formatMoney(delivered)}</strong><small>Recorded delivered orders</small></article>
                        </div>
                        <div className="oi-seller-dashboard__section-head"><h3>Recent products</h3><button type="button" className="oi-seller-dashboard__text-button" onClick={() => setActiveTab("products")}>Manage products →</button></div>
                        <div className="oi-seller-dashboard__product-list">{setup.products.slice(0, 3).map(productRow)}</div>
                    </>}
                    {activeTab === "products" && <>
                        {productFormOpen && <form className="oi-seller-dashboard__add-form" onSubmit={event => { if (addProduct(event)) setProductFormOpen(false); }}><label className="oi-seller-setup__field">Product name<input required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} /></label><label className="oi-seller-setup__field">Price (₦)<input required type="number" min="1" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></label><label className="oi-seller-setup__field">Pack size<input required value={product.size} onChange={e => setProduct({ ...product, size: e.target.value })} /></label><label className="oi-seller-setup__field">Stock<input required type="number" min="0" value={product.stock} onChange={e => setProduct({ ...product, stock: e.target.value })} /></label><button className="oi-btn oi-btn--primary" type="submit">Save product</button>{error && <p role="alert" className="oi-seller-setup__error">{error}</p>}</form>}
                        <div className="oi-seller-dashboard__product-list">{setup.products.length ? setup.products.map(productRow) : <p className="oi-seller-dashboard__empty">No products yet. Add your first product to start building your catalogue.</p>}</div>
                    </>}
                    {activeTab === "inventory" && <div className="oi-seller-dashboard__product-list"><p className="oi-seller-dashboard__hint">Update stock quantities inline. Products with zero stock remain listed but cannot be fulfilled.</p>{setup.products.map(productRow)}</div>}
                    {activeTab === "orders" && <div className="oi-seller-dashboard__orders">{setup.orders.length ? setup.orders.map(order => <article key={order.id}><div><b>Order {order.id}</b><span>{order.customer} · {new Date(order.createdAt).toLocaleDateString()}</span><small>{order.items.map(item => `${item.quantity} × ${item.name}`).join(", ")}</small></div><strong>{formatMoney(order.total)}</strong><select aria-label={`Status for order ${order.id}`} value={order.status} onChange={event => updateOrderStatus(order.id, event.target.value as SellerOrder["status"])}>{["New", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => <option key={status}>{status}</option>)}</select></article>) : <div className="oi-seller-dashboard__empty-state"><Icon name="receipt" size={24} /><h3>No orders yet</h3><p>Orders placed for your products will appear here when the shop is connected to the marketplace order service.</p></div>}</div>}
                    {activeTab === "earnings" && <><div className="oi-seller-dashboard__metrics"><article><span>Delivered sales</span><strong>{formatMoney(delivered)}</strong><small>Based on delivered orders</small></article><article><span>Pending order value</span><strong>{formatMoney(pending)}</strong><small>Not yet delivered</small></article><article><span>Available for payout</span><strong>{formatMoney(0)}</strong><small>Payout setup is not connected</small></article></div><p className="oi-seller-dashboard__hint">Earnings are calculated from order records. Payouts and transaction fees are not connected yet.</p></>}
                    {activeTab === "subscription" && <div className="oi-seller-dashboard__plan"><span className="oi-eyebrow oi-eyebrow--green">CURRENT PLAN</span><h3>{setup.plan}</h3><p>Your shop is on the free setup plan. Subscription billing and paid plan management are not connected yet.</p></div>}
                    {activeTab === "settings" && <div className="oi-seller-dashboard__settings"><label className="oi-seller-setup__field">Shop name<input value={setup.shop} onChange={event => save({ ...setup, shop: event.target.value })} /></label><label className="oi-seller-setup__field">Owner<input value={setup.owner} onChange={event => save({ ...setup, owner: event.target.value })} /></label><label className="oi-seller-setup__field">Location<input value={setup.location} onChange={event => save({ ...setup, location: event.target.value })} /></label><label className="oi-seller-setup__field">Shop introduction<input value={setup.tagline} onChange={event => save({ ...setup, tagline: event.target.value })} /></label></div>}
                    <div className="oi-seller-dashboard__footer"><p>Your shop is published and ready for buyers.</p><div className="oi-seller-dashboard__footer-actions"><Link className="oi-btn oi-btn--outline" href={`/shops/${shopSlug}`}>View storefront <Icon name="arrow-right" size={16} /></Link><Link className="oi-btn oi-btn--outline" href="/marketplace">Go to marketplace <Icon name="arrow-right" size={16} /></Link></div></div>
                </div>
              </div>
              </div>
            </section>
        );
    }

    return <section className="oi-view oi-container"><p>Shop setup could not be loaded. Return to the <Link className="oi-link" href="/seller">seller overview</Link> and try again.</p></section>;
}
