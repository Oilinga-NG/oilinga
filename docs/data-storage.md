# Oilinga data and API

Marketplace and account persistence lives in PostgreSQL through the Express/Prisma service in `../../oilinga_BE`. The Next.js app is a client of that API; there is no Next API database proxy or JSON file database.

Set `NEXT_PUBLIC_API_BASE_URL` in the frontend environment to the backend API base. Local development uses `http://localhost:4000/api/v1`. The browser keeps the short-lived JWT access token in local storage and sends it as a bearer token. Configure `FRONTEND_ORIGIN`, `JWT_ACCESS_SECRET`, `DATABASE_URL`, and Paystack secrets in the backend environment; never expose server secrets through `NEXT_PUBLIC_` variables.

`lib/api-client.ts` handles request headers, response envelopes and shared request state. `lib/backend-client.ts` maps backend records into the view models used by account, seller and admin screens. `lib/backend-mappers.ts` handles the Prisma-to-UI product, shop, order and review shapes.

The backend owns authentication, marketplace data, carts, wishlists, orders, reviews, subscriptions, admin settings and settlement records. Guest cart and wishlist drafts may remain in browser storage until the visitor signs in; after sign-in they are synced to the account endpoints. Existing JSON database contents are not imported automatically. Do not copy legacy session tokens or password hashes into the new service; use a separately reviewed and sanitized migration if existing accounts must be preserved.

Apply backend schema migrations with `npm run prisma:deploy` (or `npx prisma migrate dev` in local development), then run `npm run seed` to create the default marketplace categories and commission setting.
