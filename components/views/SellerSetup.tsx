"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
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
type SellerOrder = {
    id: string;
    customer: string;
    createdAt: string;
    total: number;
    status: "New" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
    items: { productId: string; name: string; quantity: number }[];
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
type WorkspaceTab = "overview" | "products" | "inventory" | "orders" | "earnings" | "subscription" | "settings";

type ProductDraft = Omit<Listing, "id" | "dbId" | "status">;
const blankProduct: ProductDraft = { name: "", price: "", size: "", stock: "", category: "crude-palm", description: "", imageUrl: "", media: [] };

function mediaToText(media?: ProductMedia[]) {
    return (media ?? []).map(item => item.url).join("\n");
}

function textToMedia(value: string): ProductMedia[] {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(url => ({ url }));
}
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
    const [settingsDraft, setSettingsDraft] = useState({ shop: "", owner: "", location: "", tagline: "", description: "" });

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
            await mutateBackendData("request-verification", {});
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
            await mutateBackendData("update-shop", {
                shop: {
                    slug: slugifyShopName(settingsDraft.shop),
                    name: settingsDraft.shop,
                    owner: settingsDraft.owner,
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

    function updateOrderStatus(orderId: string, status: SellerOrder["status"]) {
        if (!setup) return;
        setSetup({ ...setup, orders: setup.orders.map(order => order.id === orderId ? { ...order, status } : order) });
        void mutateBackendData("update-order", { orderId, status }).catch(error => setError(error instanceof Error ? error.message : "Could not update this order."));
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
                                <div className="oi-seller-dashboard__metrics">
                                    <article><span>Products</span><strong>{setup.products.length}{limit !== -1 ? ` / ${limit}` : ""}</strong><small>In your catalogue</small></article>
                                    <article><span>Units in stock</span><strong>{inventory}</strong><small>Across all products</small></article>
                                    <article><span>Orders</span><strong>{setup.orders.length}</strong><small>Received by your shop</small></article>
                                    <article><span>Delivered sales</span><strong>{formatMoney(delivered)}</strong><small>Recorded delivered orders</small></article>
                                </div>
                                <div className="oi-seller-dashboard__section-head"><h3>Recent products</h3><button type="button" className="oi-seller-dashboard__text-button" onClick={() => setActiveTab("products")}>Manage products →</button></div>
                                <div className="oi-seller-dashboard__product-list">{setup.products.slice(0, 3).map(productRow)}</div>
                            </>}
                            {activeTab === "products" && <>
                                {productFormOpen && !atLimit && <form className="oi-seller-dashboard__add-form" onSubmit={async event => { if (await addProduct(event)) setProductFormOpen(false); }}><label className="oi-seller-setup__field">Product name<input required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} /></label><label className="oi-seller-setup__field">Category<select required value={product.category} onChange={e => setProduct({ ...product, category: e.target.value as ProductCategory })}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="oi-seller-setup__field">Product description<textarea required value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} rows={3} /></label><label className="oi-seller-setup__field">Price (₦)<input required type="number" min="1" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></label><label className="oi-seller-setup__field">Pack size<input required value={product.size} onChange={e => setProduct({ ...product, size: e.target.value })} /></label><label className="oi-seller-setup__field">Stock<input required type="number" min="0" value={product.stock} onChange={e => setProduct({ ...product, stock: e.target.value })} /></label><ProductImageFields value={product} onChange={patch => setProduct(current => ({ ...current, ...patch }))} /><button className="oi-btn oi-btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save product"}</button>{error && <p role="alert" className="oi-seller-setup__error">{error}</p>}</form>}
                                <div className="oi-seller-dashboard__product-list">{setup.products.length ? setup.products.map(productRow) : <p className="oi-seller-dashboard__empty">No products yet. Add your first product to start building your catalogue.</p>}</div>
                            </>}
                            {activeTab === "inventory" && <div className="oi-seller-dashboard__product-list"><p className="oi-seller-dashboard__hint">Update stock quantities inline. Products with zero stock remain listed but cannot be fulfilled.</p>{setup.products.map(productRow)}</div>}
                            {activeTab === "orders" && <div className="oi-seller-dashboard__orders">{setup.orders.length ? setup.orders.map(order => <article key={order.id}><div><b>Order {order.id}</b><span>{order.customer} · {new Date(order.createdAt).toLocaleDateString()}</span><small>{order.items.map(item => `${item.quantity} × ${item.name}`).join(", ")}</small></div><strong>{formatMoney(order.total)}</strong><select aria-label={`Status for order ${order.id}`} value={order.status} onChange={event => updateOrderStatus(order.id, event.target.value as SellerOrder["status"])}>{["New", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => <option key={status}>{status}</option>)}</select></article>) : <div className="oi-seller-dashboard__empty-state"><Icon name="receipt" size={24} /><h3>No orders yet</h3><p>Orders placed for your products will appear here.</p></div>}</div>}
                            {activeTab === "earnings" && <>
                                <div className="oi-seller-dashboard__metrics">
                                    <article><span>Delivered sales</span><strong>{formatMoney(delivered)}</strong><small>Based on delivered orders</small></article>
                                    <article><span>Pending order value</span><strong>{formatMoney(pending)}</strong><small>Not yet delivered</small></article>
                                    <article><span>Commission rate</span><strong>{currentPlan?.commission ?? 4}%</strong><small>On {currentPlan?.name ?? "Starter"} plan</small></article>
                                </div>
                                <p className="oi-seller-dashboard__hint">Earnings calculated from order records. <Link href="/seller/pricing" className="oi-link">Upgrade your plan</Link> to reduce your commission rate.</p>
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
                                    <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={saving} onClick={() => void updateShop()}>{saving ? "Saving…" : "Save shop profile"}</button>
                                    {error && <p role="alert" className="oi-seller-setup__error">{error}</p>}

                                    <div className="oi-seller-dashboard__visibility">
                                        <div>
                                            <h3>Verification & visibility</h3>
                                            <p>
                                                <b>{setup.verified ? "Verified" : setup.verificationRequestedAt ? "Verification requested" : "Not verified"}</b>
                                                {" · "}
                                                <b>{setup.published ? "Published" : "Unpublished"}</b>
                                            </p>
                                            <small>{setup.verified
                                                ? setup.status === "Paused"
                                                    ? "Your shop is paused. Contact an administrator before publishing."
                                                    : "Publishing makes your shop and eligible products visible in the marketplace."
                                                : "Admin verification is required before your shop can be published."}</small>
                                        </div>
                                        <div className="oi-seller-dashboard__visibility-actions">
                                            {!setup.verified && <button className="oi-btn oi-btn--outline oi-btn--sm" type="button" disabled={saving} onClick={() => void requestVerification()}>{saving ? "Sending…" : "Request verification"}</button>}
                                            <button className="oi-btn oi-btn--primary oi-btn--sm" type="button" disabled={saving || (!setup.published && (!setup.verified || setup.status === "Paused"))} onClick={() => void setPublication(!setup.published)}>{setup.published ? "Unpublish shop" : "Publish shop"}</button>
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
