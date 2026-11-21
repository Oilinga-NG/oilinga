# Implementation Plan — Replace Static/Dummy Data with Live API Fetches

## Findings Summary

**Already wired (no code change needed):**
- `lib/reviews.ts` — all four review functions use `apiFetch` against `/api/database`. ✅
- `components/marketplace/ProductReviews.tsx` — uses `reviewsForProduct()` via `apiFetch`. ✅
- `components/views/AccountReviews.tsx` — uses `readReviews()` via `apiFetch`. **One gap:** the product selector dropdown imports `products` from `lib/data.ts` (item 10 below).
- `components/views/OrdersView.tsx` — uses `readFileData("orders")` → `apiFetch /api/database?view=orders`. ✅
- `components/views/OrderDetailView.tsx` — uses `readFileData("order", { id })` → `apiFetch /api/database?view=order&id=ID`. ✅
- `components/views/CheckoutView.tsx` — uses `writeFileData("create-order", …)` → `apiFetch POST /api/database`. **One gap:** no localStorage fallback for guest checkout, but current code requires auth before showing the form, so this is consistent — the brief says note it, not change it.
- `lib/cart-context.tsx` — syncs to `/api/database?view=cart` when authenticated, falls back to localStorage for guests. ✅
- `lib/wishlist-context.tsx` — syncs to `/api/database?view=wishlist` when authenticated, falls back to localStorage for guests. ✅
- `components/views/WishlistView.tsx` — empty state already shows `no-products.svg` illustration. ✅ (Spec says `empty-cart.svg`; illustration used is `no-products.svg` — flag only, do not silently change user-visible asset.)
- `components/views/OrdersView.tsx` — empty state already shows `no-orders.svg`. ✅

**Need work:**
- `lib/api.ts` — does not exist yet; needs to be created.
- `components/views/HomeView.tsx` — uses static `featuredProducts`/`featuredShops` from `lib/data.ts`.
- `app/(site)/marketplace/page.tsx` — imports `products`, `filterProducts`, `getShop` from `lib/data.ts` for server-side filtering and category counts.
- `app/(site)/shops/page.tsx` — imports `shops`, `filterShops` from `lib/data.ts`.
- `app/(site)/shops/[slug]/page.tsx` — `generateStaticParams` lists all static shops; `getShop`, `productsForShop`, `otherShops` from `lib/data.ts`.
- `app/(site)/products/[slug]/page.tsx` — `generateStaticParams` lists all static products; `getProduct`, `relatedProducts`, `getShop` from `lib/data.ts`.
- `components/marketplace/ShopCard.tsx` — calls `productsForShop()` from `lib/data.ts` to show product count; this only counts static seed products, missing DB-created ones.
- `components/views/AccountReviews.tsx` — product selector imports `products` from `lib/data.ts`.

---

## Duplication / Source Reconciliation Notes

The API's `?view=marketplace` already returns both seed products (compiled into the response by the route at `/api/database/route.ts`) **and** DB-created seller products from the file database. Wait — actually reading `route.ts` carefully: it only returns `database.shops` products (DB-created). The seed data (`lib/data.ts` products/shops) is not served by the API; it is imported directly into page components.

**Decision:** After migration, seed products/shops come from `lib/api.ts → fetchMarketplace()`, which calls `/api/database?view=marketplace`. The API currently returns only DB-created products. We must wire the seed data into the API response. The cleanest approach (per spec rule 2: pages must not import from `lib/data.ts`) is to have `fetchMarketplace()` merge the static seed data server-side before returning, so the API caller always gets the full combined list. This is done inside `lib/api.ts` — it fetches the DB products/shops, then merges the static arrays from `lib/data.ts` (which is allowed in lib files). This avoids touching the API route and keeps the merge in one place.

`PublishedSellerProducts` (client component in `PublishedSellerShop.tsx`) currently also calls `readFileData("marketplace")` on the client to get DB-created products and merges them with the `baseProducts` prop passed from the server. After migration the `baseProducts` prop will already include DB-created products (merged by `fetchMarketplace()`), so `PublishedSellerProducts` must stop double-fetching. We remove its internal `useEffect` fetch and render only from `baseProducts`.

`PublishedSellerShop mode="directory"` calls `readFileData("marketplace")` for DB shops. After migration, the shops page will pass API-fetched shops (which include DB shops) as a prop. `PublishedSellerShop mode="directory"` can be replaced with inline rendering in the shops page — or its `mode="directory"` path is kept only as a fallback when the passed list is empty. The simplest reconciliation: remove the `mode="directory"` usage from the shops page and render `ShopGrid` with the merged list from `fetchMarketplace()`. `PublishedSellerShop mode="storefront"` stays as-is for the slug fallback.

`ShopCard` calls `productsForShop()` which counts only static seed products. After migration, seed shop objects passed from `fetchMarketplace()` will carry a `productCount` field we add during the merge in `lib/api.ts`, or we accept the count is 0 for seed shops in the card — the simplest fix is to extend the `Shop` type with an optional `productCount` and populate it in `lib/api.ts`.

---

## Implementation Plan

- [ ] 1. Create `lib/api.ts` with four server-side fetch helpers.
  
  Create a new file. It uses bare `fetch()` (not `apiFetch`, which is client-only). The `fetchMarketplace()` function calls `fetch(base + "/database?view=marketplace")`, receives DB-created products/shops, then **merges** the static seed arrays from `lib/data.ts` (deduplicating by slug) so the caller always gets the full combined catalogue. The merge strategy: seed items first, then DB items — if a slug already exists in the seed list, skip the DB item (seeds are canonical). `fetchShop(slug)` tries the DB via `?view=shop&slug=…`; returns `null` if not found (never throws). `fetchReviews()` calls `?view=reviews&targetType=…&targetId=…`. `fetchRatingStats()` calls `?view=rating-stats`. All functions return properly typed results using the existing `Shop`, `Product`, `Review` types from `lib/data.ts`/`lib/types.ts`.

  Also add an optional `productCount?: number` field to the `Shop` interface in `lib/data.ts` so `ShopCard` can display the count without calling `productsForShop()`.

  Files:
  - CREATE `lib/api.ts`
  - MODIFY `lib/data.ts` — add `productCount?: number` to `Shop` interface

  Verify: `yarn build` at `/Users/mac/Desktop/oilinga` — TypeScript compiles cleanly with no errors.

---

- [ ] 2. Convert `components/views/HomeView.tsx` to an `async` Server Component that fetches live data.

  Remove imports of `featuredProducts`, `featuredShops` from `lib/data.ts`. Add `import { fetchMarketplace } from "@/lib/api"`. Make the function `async`. Call `const { shops, products } = await fetchMarketplace()` at the top. Derive `featuredShops = shops.slice(0, 4)` and `featuredProducts = products.slice(0, 4)`. Keep `categories` and `popularSearches` imported from `lib/data.ts`. Add empty-state guards: if `shops` is empty render a `<p>No shops yet</p>` placeholder inside the "Shops to know" Section; if `products` is empty render a `<p>No products yet — check back soon</p>` inside the "Featured products" Section.

  Also update `app/(site)/page.tsx`: change `export default function HomePage()` to `export default async function HomePage()` (or remove the wrapper and inline, whichever avoids the `async` Server Component boundary issue — the simplest fix is to call `fetchMarketplace()` in `page.tsx` and pass data as props to `HomeView`).

  Decision: Call `fetchMarketplace()` in `app/(site)/page.tsx` and pass `featuredShops` and `featuredProducts` as props to `HomeView`, making `HomeView` a plain (non-async) Server Component that receives props. This keeps `HomeView` composable and avoids a double Server Component async context.

  Files:
  - MODIFY `components/views/HomeView.tsx` — accept `featuredShops: Shop[]` and `featuredProducts: Product[]` as props; remove static data imports; add empty-state guards.
  - MODIFY `app/(site)/page.tsx` — make `async`, call `fetchMarketplace()`, pass slices as props to `HomeView`.

  Verify: `yarn build` — no TypeScript errors; homepage renders without importing `featuredProducts`/`featuredShops` from `lib/data.ts`.

---

- [ ] 3. Update `app/(site)/marketplace/page.tsx` to fetch products from the API and strip `lib/data.ts` product/shop imports.

  Remove imports of `products`, `filterProducts`, `getShop` from `lib/data.ts`. Add `import { fetchMarketplace } from "@/lib/api"`. At the top of the page function, call `const { products: allProducts, shops: allShops } = await fetchMarketplace()`. Re-implement `verifiedProducts` count using `allProducts.filter(p => allShops.find(s => s.slug === p.shopSlug)?.verified)`.

  The existing `categoryCounts()` import from `lib/data.ts` only counts static products — replace it with an inline `categoryCounts` derived from `allProducts`. The existing `categories` import from `lib/data.ts` is UI-defined and stays.

  Pass `allProducts` (unfiltered) to `PublishedSellerProducts` as `baseProducts` with the query params for client-side filtering. The count badge `{products.length}` in the filter sidebar should show `allProducts.length`.

  Modify `PublishedSellerProducts` in `components/marketplace/PublishedSellerShop.tsx`: remove its internal `useEffect` that fetches `readFileData("marketplace")` again (it would duplicate the DB items already in `baseProducts`). The component now purely does client-side filter/sort on the `baseProducts` prop.

  Files:
  - MODIFY `app/(site)/marketplace/page.tsx`
  - MODIFY `components/marketplace/PublishedSellerShop.tsx` — delete the `useEffect` / `readFileData` call inside `PublishedSellerProducts`; remove `ready` state; always render from `baseProducts`.

  Verify: `yarn build` — no TypeScript errors; no import of `products`/`filterProducts`/`getShop` remains in `marketplace/page.tsx`.

---

- [ ] 4. Update `app/(site)/shops/page.tsx` to fetch shops from the API and strip `lib/data.ts` shop imports.

  Remove imports of `shops`, `filterShops` from `lib/data.ts`. Add `import { fetchMarketplace } from "@/lib/api"`. Fetch `const { shops: allShops } = await fetchMarketplace()`. Implement inline filtering (replaces `filterShops`): filter `allShops` by `q` and `category` using the same logic that was in `filterShops`. `categories` import from `lib/data.ts` stays.

  Remove the `<PublishedSellerShop mode="directory" query={q} />` render — DB shops are now already in `allShops` from `fetchMarketplace()`. The result count bar should reference `allShops.length` as the total and `results.length` for filtered count. Empty state is already handled by the existing `{results.length > 0 ? <ShopGrid> : <empty div>}` block — keep it.

  Files:
  - MODIFY `app/(site)/shops/page.tsx`

  Verify: `yarn build` — no TypeScript errors; no import of `shops`/`filterShops` from `lib/data.ts`; `PublishedSellerShop mode="directory"` usage removed.

---

- [ ] 5. Update `components/marketplace/ShopCard.tsx` to remove the `productsForShop()` call.

  `productsForShop()` only counts static seed products. After migration, Shop objects from `fetchMarketplace()` carry an optional `productCount` field (added in item 1). Update `ShopCard` to use `shop.productCount ?? 0` instead of calling `productsForShop()`. Remove the import of `productsForShop` from `lib/data.ts`.

  Files:
  - MODIFY `components/marketplace/ShopCard.tsx`

  Verify: `yarn build` — no TypeScript errors; no import of `productsForShop` from `lib/data.ts`.

---

- [ ] 6. Update `app/(site)/shops/[slug]/page.tsx` to use `fetchShop()` and remove static shop imports.

  Remove imports of `getShop`, `productsForShop`, `otherShops`, `shops` from `lib/data.ts`. Add `import { fetchShop, fetchMarketplace } from "@/lib/api"`.

  Change `generateStaticParams` to `return []` (dynamic rendering).

  In `generateMetadata`, call `await fetchShop(slug)` instead of `getShop(slug)`.

  In the page body:
  1. Call `const shop = await fetchShop(slug)`.
  2. If `shop` is null → render `<PublishedSellerShop mode="storefront" slug={slug} />` (unchanged fallback for DB shops).
  3. If `shop` is found, derive `items` from shop's products (the `Shop` object from `fetchMarketplace` already carries DB-computed product lists via `publicShop()` in the API route — but `fetchShop` returns the DB-only record). To get the seed shop's products, call `fetchMarketplace()` and find products where `shopSlug === shop.slug`.
  4. For "Other shops to know": call `fetchMarketplace()` and filter out current shop, take 3.

  To avoid calling `fetchMarketplace()` twice, do one call: `const { shops: allShops, products: allProducts } = await fetchMarketplace()`. Then: `const shop = allShops.find(s => s.slug === slug) ?? await fetchShop(slug)`. If still null → `<PublishedSellerShop mode="storefront" slug={slug} />`. Items and others derived from `allShops`/`allProducts`.

  Files:
  - MODIFY `app/(site)/shops/[slug]/page.tsx`

  Verify: `yarn build` — no TypeScript errors; `generateStaticParams` returns `[]`; no `lib/data.ts` shop-data imports remain.

---

- [ ] 7. Update `app/(site)/products/[slug]/page.tsx` to use `fetchMarketplace()` for product lookup and remove static product imports.

  Remove imports of `getProduct`, `relatedProducts`, `getShop`, `products` from `lib/data.ts`. Keep `getCategoryName` import (it uses the static `categories` array, which is UI-defined and allowed).

  Add `import { fetchMarketplace } from "@/lib/api"`.

  Change `generateStaticParams` to `return []`.

  In `generateMetadata`, call `fetchMarketplace()` and find the product by slug.

  In the page body:
  1. Call `const { products: allProducts, shops: allShops } = await fetchMarketplace()`.
  2. Find `const product = allProducts.find(p => p.slug === slug)`. If not found → `notFound()`.
  3. Find `const shop = allShops.find(s => s.slug === product.shopSlug) ?? null`.
  4. Related products: `allProducts.filter(p => p.slug !== slug && p.category === product.category).slice(0, 4)`.

  Note on slug format: seed products use plain slugs like `"premium-red-palm-oil"`. DB-created products use `"${shop.slug}-${name-slug}-${id}"`. The `fetchMarketplace()` merger in `lib/api.ts` preserves both slug formats. The `find(p => p.slug === slug)` will match either format.

  Files:
  - MODIFY `app/(site)/products/[slug]/page.tsx`

  Verify: `yarn build` — no TypeScript errors; `generateStaticParams` returns `[]`; no `lib/data.ts` product-data imports remain in this file.

---

- [ ] 8. Fix `components/views/AccountReviews.tsx` product selector — remove static `products` import.

  The product selector dropdown currently populates from `import { products } from "@/lib/data"`. Since `AccountReviews` is a Client Component (`"use client"`), it cannot call server-only `fetchMarketplace()` directly. Instead, fetch the product list via `apiFetch("/database?view=marketplace")` inside a `useEffect` on mount (same pattern already used elsewhere in the component file for `readReviews()`). Store the result in a `products` state variable; keep a loading state while fetching so the select renders "Loading products…" until ready.

  Remove `import { products } from "@/lib/data"`.

  Files:
  - MODIFY `components/views/AccountReviews.tsx`

  Verify: `yarn build` — no TypeScript errors; no import of `products` from `lib/data.ts` in this file.

---

- [ ] 9. Verify empty states are complete across all listing pages.

  Audit the following and add any missing empty states:

  - **Products list (marketplace)** — `PublishedSellerProducts` already renders an `oi-empty` card with the search icon and "No products match those filters" message when the filtered list is empty. ✅ But add a secondary check: when `allProducts.length === 0` (API returned nothing), show the `no-products.svg` illustration with "No products yet — check back soon" in the `oi-empty` block. Update `PublishedSellerProducts` to accept an `isEmpty` prop or check `baseProducts.length === 0 && !query` to render the illustration variant.
  - **Shops list** — empty state with Icon already exists in `shops/page.tsx`. ✅ No change needed.
  - **Orders list** — `no-orders.svg` illustration already in `OrdersView.tsx`. ✅
  - **Wishlist** — `no-products.svg` illustration already in `WishlistView.tsx`. (Spec says `empty-cart.svg` but file uses `no-products.svg` — change the `src` to `/assets/illustrations/empty-cart.svg` and update `alt` to "Your wishlist is empty" to match the spec. Both SVG files exist in `public/assets/illustrations/`.)

  Files:
  - MODIFY `components/marketplace/PublishedSellerShop.tsx` — add illustration fallback for truly-empty product list.
  - MODIFY `components/views/WishlistView.tsx` — change illustration `src` to `empty-cart.svg`.

  Verify: `yarn build` — no TypeScript errors.

---

- [ ] 10. Final build verification.

  Run `yarn build` from `/Users/mac/Desktop/oilinga`. Confirm:
  - Exit code 0 (TypeScript clean, no build errors).
  - No page imports `products`, `shops`, `filterProducts`, `filterShops`, `getShop`, `getProduct`, `relatedProducts`, `productsForShop`, `otherShops`, `featuredProducts`, or `featuredShops` from `lib/data.ts` (run `grep -r "from.*lib/data" app/ components/views/ components/marketplace/` to confirm allowed imports are only `categories`, `trustSignals`, `popularSearches`, `sellerNav`, `sellerMetrics`, `recentOrders`, `getCategoryName`, and type imports).
  - `lib/data.ts` itself is untouched except for the `productCount` field addition.

  Files: none — verification step only.

  Verify: `yarn build` exits 0 at `/Users/mac/Desktop/oilinga`.

---

## Notes for the Implementing Agent

### lib/api.ts scaffold (server-side only — no "use client")

```ts
import type { Shop, Product } from "@/lib/data";
import { shops as seedShops, products as seedProducts } from "@/lib/data";
import type { Review } from "@/lib/types";

const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api").replace(/\/$/, "");

export async function fetchMarketplace(): Promise<{ shops: Shop[]; products: Product[] }> {
    try {
        const res = await fetch(`${base}/database?view=marketplace`, { cache: "no-store" });
        if (!res.ok) return { shops: seedShops, products: seedProducts };
        const data = await res.json() as { shops: Shop[]; products: Product[] };
        // Merge: seed items first, DB items appended if slug not already present
        const dbShopSlugs = new Set(data.shops.map(s => s.slug));
        const dbProductSlugs = new Set(data.products.map(p => p.slug));
        const shops: Shop[] = [
            ...seedShops.map(s => ({ ...s, productCount: seedProducts.filter(p => p.shopSlug === s.slug).length })),
            ...data.shops.filter(s => !dbShopSlugs.has(/* already in seed check */ s.slug) || true)
                // keep all DB shops; dedup by checking against seed slugs
                .filter(s => !seedShops.some(seed => seed.slug === s.slug))
                .map(s => ({ ...s, productCount: (s as unknown as { products?: unknown[] }).products?.length ?? 0 })),
        ];
        // Note: seed slug set
        const seedSlugSet = new Set(seedShops.map(s => s.slug));
        const mergedShops: Shop[] = [
            ...seedShops.map(s => ({ ...s, productCount: seedProducts.filter(p => p.shopSlug === s.slug).length })),
            ...data.shops.filter(s => !seedSlugSet.has(s.slug)),
        ];
        const seedProductSlugSet = new Set(seedProducts.map(p => p.slug));
        const mergedProducts: Product[] = [
            ...seedProducts,
            ...data.products.filter(p => !seedProductSlugSet.has(p.slug)),
        ];
        return { shops: mergedShops, products: mergedProducts };
    } catch {
        return { shops: seedShops, products: seedProducts };
    }
}
// ... fetchShop, fetchReviews, fetchRatingStats follow same pattern
```

The scaffold above has a logic draft error in the merge (double-definition of `shops`). The implementing agent must write clean final code — the intent is:
1. Start with seed arrays.
2. Append DB items whose slug is NOT in the seed set.
3. Fall back to seed-only if fetch fails.

### generateStaticParams change

Both `app/(site)/shops/[slug]/page.tsx` and `app/(site)/products/[slug]/page.tsx` currently export `generateStaticParams` that returns all static slugs. Change both to `export function generateStaticParams() { return []; }`. This tells Next.js to render these routes dynamically on request, which is correct since product/shop data now comes from the database.

### TypeScript strictness

- `lib/api.ts` must have no `any`. Use `unknown` for intermediate JSON parsing and cast after validation.
- The `Shop` and `Product` types from `lib/data.ts` are the canonical types — use them throughout. The DB route returns a `publicShop()` shape that is a subset; ensure the merge produces full `Shop`/`Product` objects by filling missing fields with defaults (e.g., `initials`, `accent`, `since`, `specialties` for DB shops).

### Checkout localStorage gap

The spec asks to note this. `CheckoutView` currently shows a "Sign in to check out" gate for unauthenticated users, so the localStorage fallback is not a gap in the current UX — it's by design. No code change is required; the spec says "verify and note."

### Verdict file path

`/Users/mac/Desktop/oilinga/.agents/tasks/task-api-migration/verdict.json`
