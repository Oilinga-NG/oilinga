"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import { IconButton } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { RouteSearch } from "@/components/marketplace/RouteSearch";

const navigation = [
    { href: "/", label: "Home" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/shops", label: "Shops" },
    { href: "/seller", label: "For Sellers" },
    { href: "/about", label: "About" },
];

export function SiteHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, ready, signOut } = useAuth();
    const { totalCount } = useCart();
    const { items: wishlistItems } = useWishlist();
    const wishlistCount = wishlistItems.length;
    const [menuOpen, setMenuOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    // Close on route change
    useEffect(() => {
        setMenuOpen(false);
        setAccountMenuOpen(false);
    }, [pathname]);

    // Scroll lock + focus the close button when drawer opens
    useEffect(() => {
        if (menuOpen) {
            document.body.classList.add("oi-drawer-open");
            requestAnimationFrame(() => closeRef.current?.focus());
        } else {
            document.body.classList.remove("oi-drawer-open");
        }
        return () => document.body.classList.remove("oi-drawer-open");
    }, [menuOpen]);

    // Escape closes drawer and returns focus
    useEffect(() => {
        if (!menuOpen) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setMenuOpen(false);
                toggleRef.current?.focus();
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    // Click outside drawer closes it
    useEffect(() => {
        if (!menuOpen) return;
        function onPointerDown(e: PointerEvent) {
            const nav = document.getElementById("primary-navigation");
            const toggle = toggleRef.current;
            if (
                nav && !nav.contains(e.target as Node) &&
                toggle && !toggle.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    // Account menu outside-click / escape
    useEffect(() => {
        if (!accountMenuOpen) return;
        function handle(e: MouseEvent | KeyboardEvent) {
            if (e instanceof KeyboardEvent && e.key === "Escape") {
                setAccountMenuOpen(false);
            }
            if (
                e instanceof MouseEvent &&
                e.target instanceof Element &&
                !e.target.closest("[data-account-menu]")
            ) {
                setAccountMenuOpen(false);
            }
        }
        document.addEventListener("pointerdown", handle as EventListener);
        document.addEventListener("keydown", handle as EventListener);
        return () => {
            document.removeEventListener("pointerdown", handle as EventListener);
            document.removeEventListener("keydown", handle as EventListener);
        };
    }, [accountMenuOpen]);

    function isActive(href: string) {
        if (href === "/") return pathname === "/";
        return pathname === href || pathname.startsWith(`${href}/`);
    }

    const cartBtn = (
        <Link
            href="/cart"
            className="oi-cart-btn"
            aria-label={`Cart, ${totalCount} item${totalCount !== 1 ? "s" : ""}`}
        >
            <Icon name="bag" size={18} />
            {totalCount > 0 && (
                <span className="oi-cart-badge" aria-hidden="true">{totalCount}</span>
            )}
        </Link>
    );

    const wishlistBtn = (
        <Link
            href="/wishlist"
            className="oi-wishlist-btn"
            aria-label={`Wishlist, ${wishlistCount} item${wishlistCount !== 1 ? "s" : ""}`}
        >
            <IconButton label="Wishlist" onClick={() => { }}>
                <Icon name="heart" size={18} />
            </IconButton>
            {wishlistCount > 0 && (
                <span className="oi-wishlist-badge" aria-hidden="true">{wishlistCount}</span>
            )}
        </Link>
    );

    const searchField = (
        <RouteSearch
            basePath="/marketplace"
            placeholder="Search oils…"
            label="Search products"
        />
    );

    const accountActions = (menuId: string) =>
        !ready ? null : user ? (
            <div
                className={cn("oi-account-menu", accountMenuOpen && "is-open")}
                data-account-menu
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={(e) => {
                    if (!e.currentTarget.contains(document.activeElement))
                        setAccountMenuOpen(false);
                }}
                onFocusCapture={() => setAccountMenuOpen(true)}
                onBlurCapture={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                        setAccountMenuOpen(false);
                }}
            >
                <button
                    type="button"
                    className="oi-header-account"
                    aria-label={`Your account, ${user.name}`}
                    aria-expanded={accountMenuOpen}
                    aria-controls={menuId}
                    onClick={() => setAccountMenuOpen(true)}
                >
                    <span className="oi-header-account__avatar" aria-hidden="true">
                        {user.initials}
                    </span>
                    <span className="oi-header-account__name">
                        {user.name.split(/\s+/)[0]}
                    </span>
                    <Icon name="chevron-down" size={14} />
                </button>
                <nav className="oi-account-menu__panel" id={menuId} aria-label="Account links">
                    <div className="oi-account-menu__identity">
                        <b>{user.name}</b>
                        <small>{user.email}</small>
                    </div>
                    <Link href="/account" onClick={() => setAccountMenuOpen(false)}>Account overview</Link>
                    <Link href="/account/settings" onClick={() => setAccountMenuOpen(false)}>Profile and settings</Link>
                    <Link href="/orders" onClick={() => setAccountMenuOpen(false)}>Orders</Link>
                    <Link href="/wishlist" onClick={() => setAccountMenuOpen(false)}>Wishlist</Link>
                    <Link href="/account/reviews" onClick={() => setAccountMenuOpen(false)}>My reviews</Link>
                    <Link
                        href={user.role === "admin" ? "/admin" : "/seller"}
                        onClick={() => setAccountMenuOpen(false)}
                    >
                        {user.role === "admin" ? "Admin dashboard" : user.role === "seller" ? "Seller dashboard" : "Open a shop"}
                    </Link>
                    <button
                        type="button"
                        onClick={async () => {
                            setAccountMenuOpen(false);
                            await signOut();
                            router.push("/");
                        }}
                    >
                        <Icon name="logout" size={15} /> Log out
                    </button>
                </nav>
            </div>
        ) : (
            <>
                <ButtonLink href="/auth/login" variant="outline" size="sm">Log in</ButtonLink>
                <ButtonLink href="/auth/signup" variant="danger" size="sm">Sign up</ButtonLink>
            </>
        );

    return (
        <header className="oi-site-header">
            <div className="oi-container oi-site-header__inner">
                {/* Logo */}
                <Link className="oi-brand" href="/" aria-label="Oilinga home">
                    <Logo />
                </Link>

                {/* Slide-in drawer (mobile) / inline nav (desktop) */}
                <nav
                    id="primary-navigation"
                    className={cn("oi-nav", menuOpen && "is-open")}
                    aria-label="Primary"
                >
                    {/* Drawer header — visible on mobile only */}
                    <div className="oi-nav__header">
                        <Link
                            href="/"
                            className="oi-nav__header-brand"
                            onClick={() => setMenuOpen(false)}
                            aria-label="Oilinga home"
                        >
                            <Logo />
                        </Link>
                        <button
                            ref={closeRef}
                            type="button"
                            className="oi-nav__close"
                            aria-label="Close navigation"
                            onClick={() => {
                                setMenuOpen(false);
                                toggleRef.current?.focus();
                            }}
                        >
                            <Icon name="close" size={18} />
                        </button>
                    </div>

                    {/* Nav links */}
                    <div className="oi-nav__links">
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                className="oi-nav__link"
                                href={item.href}
                                aria-current={isActive(item.href) ? "page" : undefined}
                                onClick={() => setMenuOpen(false)}
                            >
                                {item.label}
                                <Icon name="chevron-right" size={16} className="oi-nav__link-arrow" />
                            </Link>
                        ))}
                    </div>

                    {/* Divider + search/account actions */}
                    <div className="oi-nav__divider" aria-hidden="true" />
                    <div className="oi-nav__actions">
                        {searchField}
                        <div style={{ display: "flex", gap: 8 }}>
                            {cartBtn}
                            {wishlistBtn}
                        </div>
                        {accountActions("account-menu-mobile")}
                    </div>
                </nav>

                {/* Desktop actions */}
                <div className="oi-header-actions">
                    {searchField}
                    {cartBtn}
                    {wishlistBtn}
                    {accountActions("account-menu-desktop")}
                </div>

                {/* Hamburger toggle */}
                <button
                    ref={toggleRef}
                    type="button"
                    className="oi-menu-toggle"
                    aria-expanded={menuOpen}
                    aria-controls="primary-navigation"
                    aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                    onClick={() => setMenuOpen((o) => !o)}
                >
                    <Icon name={menuOpen ? "close" : "menu"} size={20} />
                </button>
            </div>
        </header>
    );
}
