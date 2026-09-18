## Plan: Persistent TypeScript Cart

Implement a minimal server-persisted cart in the TypeScript API and wire the existing product catalog to an API-backed cart view. SQLite remains authoritative for items, quantities, snapshotted discounted prices, and totals; the browser stores only the opaque cart ID needed to recover the cart after refresh. Checkout and order conversion are deliberately excluded.

**Steps**

### Phase 1: Cart contract and persistence
1. Add `003_create_carts.sql` as a guarded forward migration. Create `carts` with an integer ID and creation timestamp, and `cart_items` with cart/product foreign keys, positive-integer quantity and non-negative unit-price checks, `ON DELETE CASCADE` from cart, `ON DELETE RESTRICT` from product, an index on `cart_id`, and a unique `(cart_id, product_id)` constraint. Include a documented manual rollback section consistent with the migration tooling; do not alter historical migrations or seed demo cart data.
2. Add cart domain and request/response interfaces alongside existing models, with Swagger schemas and camelCase fields: `Cart`, `CartItem`, `AddCartItemRequest`, and `UpdateCartItemRequest`. The aggregate `Cart` response is `{ cartId, createdAt, items, itemCount, total }`; each item contains `{ cartItemId, productId, name, imgName, quantity, unitPrice, lineTotal }`. `unitPrice` is the server-calculated discounted price rounded to cents when first added, and `total`/`lineTotal` are server-calculated and rounded to cents.
3. Implement a `CartsRepository` using the existing `DatabaseConnection`, parameterized SQL, snake_case-to-camelCase utilities where applicable, repository factory pattern, and existing domain errors. It owns the cart aggregate across `carts`, `cart_items`, and the product lookup so route handlers remain thin. Methods should create/get a cart, atomically add-or-increment a product using the unique constraint, set an existing product's absolute quantity, remove a product, project joined product display fields, and calculate item count/total. Repeated adds preserve the original price snapshot; they do not refresh it from the product table.
4. Validate positive integer path IDs and request fields before repository writes. Reject missing/non-numeric/fractional/zero/negative quantities and product IDs with `ValidationError` (400); return `NotFoundError` (404) for missing carts, products, or cart lines. Let unexpected database failures flow through the existing `errorHandler`; do not accept price, discount, totals, cart IDs, or product display data from clients.

### Phase 2: HTTP API
5. Add a Swagger-documented cart router and register it before `errorHandler` in the Express app:
   - `POST /api/carts` -> 201 with a new empty aggregate.
   - `GET /api/carts/:cartId` -> 200 aggregate or 404.
   - `POST /api/carts/:cartId/items` with `{ productId, quantity }` -> 200 updated aggregate; increment an existing line.
   - `PUT /api/carts/:cartId/items/:productId` with `{ quantity }` -> 200 updated aggregate; replace quantity.
   - `DELETE /api/carts/:cartId/items/:productId` -> 204 or 404.
   Keep cart clearing and checkout endpoints out of scope.
6. Add focused repository tests and Supertest route integration tests using the in-memory migrated database and minimal supplier/product fixtures. Cover empty creation/read, discounted snapshot and rounding, repeated-add increment without duplicate rows, absolute update, removal, aggregate item count/total, persistence across requests, bad IDs/bodies/quantities, missing cart/product/item, and foreign-key behavior. Any new explanatory code comments must be succinct Afrikaans per repository instructions.
7. Run the TypeScript API tests immediately after the first backend slice, then run its lint/typecheck/build. Fix only cart-related failures before proceeding to UI work.

### Phase 3: API-backed frontend
8. Add the cart endpoint to the frontend API configuration and implement typed cart API/query functions using the existing `axios` and `react-query` v3 stack. Create a `CartProvider`/`useCart` boundary that stores only `octocat-cart-id` in localStorage, keys server cache by cart ID, creates a cart lazily on the first add, and exposes query/mutation status plus add/update/remove operations. Do not mirror cart items or totals into localStorage or independent React state. If a stored cart ID returns 404, discard it and allow the next add to create a fresh cart.
9. Replace the product-page alert/TODO with the add mutation. Retain the per-card quantity selector as transient input, disable the action while its mutation is pending, reset quantity only after success, and show concise accessible success/error feedback without adding a notification dependency.
10. Create a responsive `/cart` view following the existing Tailwind theme: empty, loading, request-error, and populated states; product image/name, snapshotted unit price, stable quantity controls, line total, remove icon/button, total item count, and authoritative API total. Quantity changes use the absolute PUT endpoint; removal uses DELETE; controls expose pending/disabled states and text feedback. No checkout form or enabled checkout action is included.
11. Register `/cart`, add a cart link with an API-derived quantity badge to desktop/mobile navigation, and replace the footer's `#` My Cart link with router navigation. Leave the existing Checkout footer placeholder non-actionable or remove it from the cart path so it does not imply delivered checkout functionality. Preserve the established application visual language instead of introducing a new design system or dependency.

### Phase 4: End-to-end validation
12. Add a Playwright cart-flow test against the real frontend and TypeScript API: add one product, add it again and observe incrementing, add another product, open `/cart`, verify item count and discounted totals, update quantity, remove a line, reload and confirm the remaining server state persists. Use resilient accessible selectors and isolate the test with a newly created browser cart.
13. Run frontend lint/build, the scoped Playwright cart flow, then the repository's TypeScript API and frontend test targets together. Start `make dev-ts` and manually verify add, badge, cart editing, error/empty states, refresh persistence, mobile layout, and dark/light themes. Inspect `/api-docs` to confirm all cart schemas/routes render and exercise representative requests.

**Relevant files**
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/database/migrations/003_create_carts.sql` — new cart schema, constraints, indexes, rollback guidance.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/api-ts/src/models/cart.ts` — cart aggregate and request DTO interfaces with Swagger schemas.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/api-ts/src/repositories/cartsRepo.ts` — aggregate persistence, product-price lookup, upsert, projections, and totals using existing repository factories/errors.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/api-ts/src/routes/cart.ts` — validated handlers and OpenAPI route definitions.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/api-ts/src/index.ts` — mount `/api/carts`.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/api-ts/src/repositories/cartsRepo.test.ts` — repository behavior and constraints.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/api-ts/src/routes/cart.test.ts` — API status, validation, and response-contract coverage.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/api/config.ts` — cart endpoint configuration.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/context/CartContext.tsx` and `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/context/useCart.ts` — cart identity, React Query cache, and mutations without client-side item persistence.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/components/entity/product/Products.tsx` — invoke API-backed add and expose mutation feedback.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/components/Cart.tsx` — cart management view.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/App.tsx` — provider and `/cart` route wiring.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/components/Navigation.tsx` and `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/src/components/Footer.tsx` — cart navigation and badge.
- `/workspaces/microhack/03-Azure/01-04-AI/01_Agentic_SDLC/src/frontend/tests/e2e/cart-flow.spec.ts` — real browser/API persistence workflow.

**Verification**
1. From `src/`, run `make test-ts` and `make build-ts` after API work; run the API package lint command if it is not included by the Make target.
2. Run migration-backed tests against a fresh in-memory database and confirm the generated `/api-docs.json` contains all cart paths and schemas.
3. From `src/`, run `make build-frontend` and `make test-frontend`, with the cart Playwright spec scoped first for fast feedback.
4. Run `make dev-ts`; manually confirm API persistence survives browser reload, a stale local cart ID recovers cleanly, totals match discounted snapshots, and desktop/mobile plus light/dark UI states are coherent.

**Decisions**
- Cart identity is an opaque server-generated cart ID stored in localStorage. Cart contents and totals are never persisted client-side.
- Repeated Add to Cart actions increment the existing line; cart-page updates replace quantity and require a value greater than zero; removal is explicit.
- The server snapshots the current discounted unit price on first add and keeps that snapshot on later increments. The client cannot submit prices or totals.
- A cart response is an aggregate tailored to the UI, including joined product display data and authoritative item/total calculations.
- Only `api-ts` receives API implementation. The C#, Python, and Java APIs remain unchanged, so this frontend cart requires the TypeScript backend.
- Checkout, payment, order/order-detail conversion, authentication, stock reservation, tax, shipping, promo codes, and seeded demo carts are excluded.
- The cart ID acts as a bearer identifier in this unauthenticated demo. Guess-resistant ownership/authentication is deferred until real identity exists.