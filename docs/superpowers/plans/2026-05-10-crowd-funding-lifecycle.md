# Crowdfunding System Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-ready release of the current prototype, covering public funding display, admin operations, ZPAY WeChat H5 payment, Tencent Cloud TMS moderation, expense evidence details, and campaign closeout with proportional refunds.

**Architecture:** Keep Next.js App Router as the only web surface, use server-only API routes as the application boundary, and split business logic across `src/domain`, `src/application`, `src/infrastructure`, `src/validation`, and `src/shared`. Persist authoritative finance, audit, moderation, and campaign-state data in PostgreSQL; wrap ZPAY, Tencent Cloud TMS, and object storage behind server-only adapters; derive all public numbers and lists from those authoritative records.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, PostgreSQL (`pg`), ZPAY WeChat H5 API, Tencent Cloud TMS, object storage for evidence images, Vitest, Playwright, ESLint.

---

## File Map

- Modify foundation files: `package.json`, `.env.example`, `src/config/env.ts`, `src/config/navigation.ts`, `docs/PROJECT_STRUCTURE.md`, `README.md`
- Public pages: `app/page.tsx`, `app/pledges/page.tsx`, `app/expenses/page.tsx`, `app/expenses/[expenseId]/page.tsx`, `app/sponsor/page.tsx`, `app/terms/page.tsx`, `app/payment/return/page.tsx`
- Admin pages: `app/admin/page.tsx`, `app/admin/layout.tsx`, `app/admin/pledges/page.tsx`, `app/admin/refunds/page.tsx`, `app/admin/expenses/page.tsx`, `app/admin/terms/page.tsx`, `app/admin/audit-logs/page.tsx`, `app/admin/settings/page.tsx`
- Public APIs: `app/api/public/summary/route.ts`, `app/api/public/pledges/route.ts`, `app/api/public/expenses/route.ts`, `app/api/public/expenses/[expenseId]/route.ts`, `app/api/public/orders/[merchantOrderNo]/route.ts`, `app/api/public/terms/active/route.ts`
- Payment and admin APIs: `app/api/sponsorship/orders/route.ts`, `app/api/payments/notify/route.ts`, `app/api/refunds/notify/route.ts`, `app/api/admin/session/route.ts`, `app/api/admin/pledges/route.ts`, `app/api/admin/refunds/route.ts`, `app/api/admin/expenses/route.ts`, `app/api/admin/expenses/evidence/upload-url/route.ts`, `app/api/admin/terms/route.ts`, `app/api/admin/audit-logs/route.ts`, `app/api/admin/funding/close/route.ts`, `app/api/admin/funding/batch-refunds/route.ts`
- Domain and application modules: `src/domain/**`, `src/application/**`, `src/infrastructure/**`, `src/validation/**`, `src/shared/**`
- Tests: `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`, `vitest.config.ts`, `playwright.config.ts`

### Task 1: Bootstrap Runtime Contracts and Test Harness

**Files:**
- Modify: `package.json`, `.env.example`, `src/config/env.ts`, `docs/PROJECT_STRUCTURE.md`
- Create: `vitest.config.ts`, `playwright.config.ts`, `src/shared/money.ts`, `src/shared/status.ts`, `tests/unit/shared/money.test.ts`

- [ ] **Step 1: Add the missing runtime and test scripts**

Add scripts for `test:unit`, `test:integration`, `test:e2e`, and `check`, then install the supporting dependencies (`vitest`, `@playwright/test`, and `zod`).

Run: `pnpm install`
Expected: lockfile updated and install succeeds without peer dependency errors.

- [ ] **Step 2: Expand the environment contract**

Document and validate these server-only keys in `.env.example` and `src/config/env.ts`: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `ZPAY_MCH_ID`, `ZPAY_KEY`, `ZPAY_NOTIFY_URL`, `ZPAY_RETURN_URL`, `TENCENT_SECRET_ID`, `TENCENT_SECRET_KEY`, `TENCENT_TMS_REGION`, `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_REGION`, `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`, `PUBLIC_ASSET_BASE_URL`.

Run: `pnpm lint`
Expected: environment module compiles and there are no unused imports.

- [ ] **Step 3: Introduce shared money and status helpers**

Put all money parsing, fen/yuan formatting, negative-balance display, and common status-label mapping in `src/shared/money.ts` and `src/shared/status.ts` so later pages and APIs use one implementation.

Run: `pnpm test:unit -- money`
Expected: PASS for parsing, formatting, and negative-value display cases.

- [ ] **Step 4: Add the first smoke-level verification bundle**

Make `pnpm check` run `pnpm lint && pnpm build && pnpm test:unit`, and keep that command stable for every later task.

Run: `pnpm check`
Expected: PASS after the harness is in place.

- [ ] **Step 5: Commit**

Commit: `git commit -m "chore: bootstrap runtime contracts and test harness"`

### Task 2: Model the Core Data Schema and Repository Layer

**Files:**
- Modify: `src/infrastructure/persistence/client.ts`
- Create: `src/infrastructure/persistence/migrations/0001_core.sql`, `src/infrastructure/persistence/migrations/0002_assets_and_moderation.sql`, `src/domain/pledges/model.ts`, `src/domain/refunds/model.ts`, `src/domain/expenses/model.ts`, `src/domain/funding/model.ts`, `src/domain/terms/model.ts`, `src/domain/audit/model.ts`, `src/infrastructure/persistence/repositories/*.ts`, `tests/integration/persistence/core-repositories.test.ts`

- [ ] **Step 1: Create the SQL schema for authoritative records**

Define tables for `campaign_state`, `pledges`, `refunds`, `expenses`, `expense_evidence`, `moderation_reviews`, `terms_versions`, and `audit_logs`. Include unique constraints for merchant order number, refund number, and idempotency keys from payment notifications.

Run: `pnpm test:integration -- persistence`
Expected: FAIL at first because repository adapters do not exist yet.

- [ ] **Step 2: Define domain models and repository contracts**

Create focused models and interfaces for pledge lifecycle, refund lifecycle, expense detail, moderation review, terms version, and campaign closure snapshot. Keep all money fields in fen and all externally visible timestamps explicit.

Run: `pnpm lint`
Expected: PASS with no circular imports between `src/domain` modules.

- [ ] **Step 3: Implement PostgreSQL repository adapters**

Use the existing `pg` client and implement repositories under `src/infrastructure/persistence/repositories/` for the read models and write flows required by public pages, admin pages, payment callbacks, moderation, and closeout refunds.

Run: `pnpm test:integration -- persistence`
Expected: PASS for create/read/update flows, idempotent upsert behavior, and closeout snapshot queries.

- [ ] **Step 4: Commit**

Commit: `git commit -m "feat: add persistence schema and repository layer"`

### Task 3: Ship the Public Read Model and Expense Detail Flow

**Files:**
- Modify: `app/page.tsx`, `app/pledges/page.tsx`, `app/expenses/page.tsx`, `src/application/public/index.ts`, `app/api/public/summary/route.ts`, `app/api/public/pledges/route.ts`, `app/api/public/expenses/route.ts`
- Create: `app/expenses/[expenseId]/page.tsx`, `app/api/public/expenses/[expenseId]/route.ts`, `src/application/public/getSummary.ts`, `src/application/public/listPledges.ts`, `src/application/public/listExpenses.ts`, `src/application/public/getExpenseDetail.ts`, `tests/e2e/public-browse.spec.ts`

- [ ] **Step 1: Implement summary, pledge list, and expense list queries**

Replace the placeholder public APIs with real summary/list responses driven by the repository layer. Include current campaign status, cumulative statistics, and pagination-ready list shapes.

Run: `pnpm test:integration -- public-read-model`
Expected: FAIL at first until the routes call real application services.

- [ ] **Step 2: Implement the public expense detail endpoint and page**

Create `app/api/public/expenses/[expenseId]/route.ts` and `app/expenses/[expenseId]/page.tsx`, exposing public detail fields plus only the evidence images marked public.

Run: `pnpm build`
Expected: PASS and the dynamic expense detail route is statically analyzable by Next.js.

- [ ] **Step 3: Wire the public pages to real data**

Replace prototype-only text with real summary cards, real pledge rows, expense links, empty states, and a campaign-status banner that disables the sponsor CTA when the campaign is closed.

Run: `pnpm test:e2e -- public-browse`
Expected: PASS for overview, pledge list, expense list, and expense detail browsing.

- [ ] **Step 4: Commit**

Commit: `git commit -m "feat: implement public summary and expense detail views"`

### Task 4: Add Admin Session Handling and Terms Management

**Files:**
- Modify: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/terms/page.tsx`, `app/terms/page.tsx`, `app/api/admin/session/route.ts`, `app/api/admin/terms/route.ts`, `app/api/public/terms/active/route.ts`
- Create: `src/infrastructure/auth/session.ts`, `src/application/admin/login.ts`, `src/application/admin/terms.ts`, `tests/integration/admin/session-and-terms.test.ts`

- [ ] **Step 1: Implement password-based admin login**

Use `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` to create a single-admin login flow with HttpOnly session cookies. Block access to every `/admin` route when the session is missing or invalid.

Run: `pnpm test:integration -- admin-session`
Expected: PASS for login success, login failure, and protected-route rejection.

- [ ] **Step 2: Implement terms version CRUD and publish flow**

Allow the admin to create draft terms, publish exactly one active version, and keep old versions immutable for historical binding to pledges.

Run: `pnpm test:integration -- terms`
Expected: PASS for create, publish, fetch active version, and historical lookup.

- [ ] **Step 3: Replace prototype terms pages with live data**

Load the current active terms on `app/terms/page.tsx`, keep the admin terms page aligned with version status, and surface the current version label in sponsor flows.

Run: `pnpm check`
Expected: PASS with both public and admin terms routes compiling cleanly.

- [ ] **Step 4: Commit**

Commit: `git commit -m "feat: add admin session handling and terms management"`

### Task 5: Implement the ZPAY WeChat H5 Sponsor Flow

**Files:**
- Modify: `app/sponsor/page.tsx`, `app/api/sponsorship/orders/route.ts`, `app/api/payments/notify/route.ts`, `src/application/payments/index.ts`, `src/infrastructure/payments/index.ts`
- Create: `app/payment/return/page.tsx`, `app/api/public/orders/[merchantOrderNo]/route.ts`, `src/application/payments/createSponsorOrder.ts`, `src/application/payments/confirmPayment.ts`, `src/infrastructure/payments/zpay.ts`, `src/validation/sponsor.ts`, `tests/integration/payments/zpay-flow.test.ts`, `tests/e2e/sponsor-h5.spec.ts`

- [ ] **Step 1: Validate sponsor submissions and create pending orders**

Validate amount, nickname, message, and terms acceptance; then create a pending pledge/order record before any redirect happens.

Run: `pnpm test:integration -- sponsor-order`
Expected: FAIL at first because the payment adapter is not wired.

- [ ] **Step 2: Add the ZPAY adapter and H5 redirect contract**

Implement server-side request signing, order creation, response parsing, and callback validation in `src/infrastructure/payments/zpay.ts`. Persist the returned H5 jump address and use the documented H5 target field from ZPAY as the redirect URL for mobile payment.

Run: `pnpm test:integration -- zpay-flow`
Expected: PASS for sign generation, response parsing, and callback verification.

- [ ] **Step 3: Implement the return page and final-status polling**

Create `app/payment/return/page.tsx` and `app/api/public/orders/[merchantOrderNo]/route.ts` so the client can show `处理中`, poll final status, and avoid duplicate order creation after returning from ZPAY.

Run: `pnpm test:e2e -- sponsor-h5`
Expected: PASS for form submit, redirect stub, return-page polling, and final success/failure rendering.

- [ ] **Step 4: Make payment notification handling idempotent**

Finalize `app/api/payments/notify/route.ts` so repeated notifications and delayed callbacks only update the same order once and still leave an audit trail.

Run: `pnpm check`
Expected: PASS and payment notification logic compiles without placeholder responses.

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat: implement zpay wechat h5 sponsor flow"`

### Task 6: Integrate Tencent Cloud TMS for Nickname and Message Moderation

**Files:**
- Modify: `app/api/sponsorship/orders/route.ts`, `app/admin/pledges/page.tsx`, `app/api/admin/pledges/route.ts`, `src/application/admin/index.ts`
- Create: `src/infrastructure/moderation/tencentTms.ts`, `src/application/public/moderateSponsorText.ts`, `src/application/admin/reviewEditedPledgeText.ts`, `src/domain/pledges/moderation.ts`, `tests/unit/pledges/moderation-policy.test.ts`, `tests/integration/tms/tms-integration.test.ts`

- [ ] **Step 1: Define the moderation policy and failure behavior**

Make the sponsor flow reject public text that fails TMS and require the user to edit the text down to anonymous or empty content before continuing; keep all moderation decisions in `moderation_reviews`.

Run: `pnpm test:unit -- moderation-policy`
Expected: FAIL at first because policy helpers do not exist yet.

- [ ] **Step 2: Implement the Tencent Cloud TMS adapter**

Wrap request signing, response parsing, result mapping, and retry-safe error handling in `src/infrastructure/moderation/tencentTms.ts`.

Run: `pnpm test:integration -- tms-integration`
Expected: PASS for approved, rejected, and timeout/error-mapping cases.

- [ ] **Step 3: Apply moderation to both user submits and admin edits**

Call TMS before creating sponsor orders and before publishing admin-edited nickname/message content. Keep the last approved public version intact until the replacement text passes review.

Run: `pnpm test:integration -- pledge-edit-moderation`
Expected: PASS for user-submit rejection, admin-edit re-review, and public-version retention.

- [ ] **Step 4: Surface moderation status in admin pages**

Show status, last review time, and failure summary in the admin pledge list or detail panel, with a retry action for recoverable failures.

Run: `pnpm build`
Expected: PASS and admin pledge screens compile against real moderation data.

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat: add tencent tms moderation for pledge text"`

### Task 7: Implement Expense Evidence Uploads and Public Detail Pages

**Files:**
- Modify: `app/admin/expenses/page.tsx`, `app/api/admin/expenses/route.ts`, `app/expenses/[expenseId]/page.tsx`, `app/api/public/expenses/[expenseId]/route.ts`
- Create: `app/api/admin/expenses/evidence/upload-url/route.ts`, `src/infrastructure/storage/minio.ts`, `src/application/admin/expenses.ts`, `src/application/public/getExpenseDetail.ts`, `tests/integration/expenses/evidence-storage.test.ts`, `tests/e2e/expense-evidence.spec.ts`

- [ ] **Step 1: Add object-storage upload support for evidence images**

Use a server-only adapter to generate upload URLs or upload on behalf of the admin, then persist metadata in `expense_evidence` with sort order and visibility flags.

Run: `pnpm test:integration -- evidence-storage`
Expected: FAIL at first because storage and metadata wiring are not complete.

- [ ] **Step 2: Extend the admin expense screen for image management**

Allow create/edit flows to attach images, reorder them, and mark each one as public or audit-only.

Run: `pnpm build`
Expected: PASS and the admin expense page compiles against real evidence metadata.

- [ ] **Step 3: Finish the public expense detail experience**

Render the evidence gallery on the detail page, exclude audit-only assets from the public API, and show a clean empty state when a record has no public evidence.

Run: `pnpm test:e2e -- expense-evidence`
Expected: PASS for public detail view, image preview, and hidden-image behavior.

- [ ] **Step 4: Commit**

Commit: `git commit -m "feat: add expense evidence management and detail views"`

### Task 8: Build Single Refunds and Campaign Closeout with Proportional Refunds

**Files:**
- Modify: `app/admin/refunds/page.tsx`, `app/api/admin/refunds/route.ts`, `src/application/refunds/index.ts`, `src/domain/funding/index.ts`
- Create: `app/api/admin/funding/close/route.ts`, `app/api/admin/funding/batch-refunds/route.ts`, `src/application/refunds/createSingleRefund.ts`, `src/application/refunds/createBatchRefund.ts`, `src/domain/funding/proportionalAllocator.ts`, `src/domain/funding/closeout.ts`, `tests/unit/funding/proportional-allocator.test.ts`, `tests/integration/refunds/closeout-refunds.test.ts`

- [ ] **Step 1: Finalize the single-refund path**

Implement the admin refund route and page around one refund source of truth, with per-order available-balance checks and ZPAY refund submission.

Run: `pnpm test:integration -- single-refund`
Expected: PASS for partial refund, full refund, over-refund rejection, and idempotent callback handling.

- [ ] **Step 2: Implement the proportional allocator**

Write and test the deterministic algorithm that allocates refund fen by current effective pledge amount, using a stable remainder strategy so the allocated sum always equals the batch total.

Run: `pnpm test:unit -- proportional-allocator`
Expected: PASS for zero-balance, exact-division, and rounding-edge cases.

- [ ] **Step 3: Add campaign-close snapshot and batch-refund APIs**

Create `app/api/admin/funding/close/route.ts` to freeze the campaign and persist the close snapshot, then create `app/api/admin/funding/batch-refunds/route.ts` to turn that snapshot into child refunds.

Run: `pnpm test:integration -- closeout-refunds`
Expected: PASS for freeze, allocation, child-refund creation, and retry-safe reruns.

- [ ] **Step 4: Wire the admin closeout UI**

Show the current campaign state, the computed refund total, the batch progress, and any failed child refunds that need retry. Disable the public sponsor CTA immediately after close.

Run: `pnpm test:e2e -- closeout-refunds`
Expected: PASS for campaign close, sponsor lockout, and batch-refund progress display.

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat: add refund center and campaign closeout flow"`

### Task 9: Add Audit, Operations, and Release Hardening

**Files:**
- Modify: `app/admin/page.tsx`, `app/admin/audit-logs/page.tsx`, `app/api/admin/audit-logs/route.ts`, `README.md`, `docs/PROJECT_STRUCTURE.md`
- Create: `src/infrastructure/audit/logger.ts`, `src/application/admin/listAuditLogs.ts`, `docs/runbooks/production.md`, `tests/e2e/admin-smoke.spec.ts`

- [ ] **Step 1: Centralize audit events**

Emit structured audit events for admin login, pledge text edits, single refunds, batch refunds, expense edits, evidence changes, terms publishes, payment notifications, and campaign closure.

Run: `pnpm test:integration -- audit-logs`
Expected: PASS for log creation and filtered retrieval.

- [ ] **Step 2: Turn the admin dashboard into a real status surface**

Replace the placeholder counts on `app/admin/page.tsx` with live metrics such as pending refunds, moderation failures, and campaign state.

Run: `pnpm build`
Expected: PASS and the dashboard renders from real APIs instead of hard-coded values.

- [ ] **Step 3: Write the production runbook**

Document environment variables, database migration order, callback URL setup, ZPAY/TMS key rotation, evidence-image storage setup, backup expectations, and launch smoke checks in `docs/runbooks/production.md`.

Run: `pnpm lint`
Expected: PASS and no broken imports or route references were introduced while updating docs-linked code.

- [ ] **Step 4: Run the final acceptance bundle**

Run the complete `pnpm check`, then run `pnpm test:e2e` for public browse, sponsor flow, expense evidence, admin session, and closeout refund scenarios before any production release candidate.

Run: `pnpm check && pnpm test:e2e`
Expected: PASS for the full release candidate.

- [ ] **Step 5: Commit**

Commit: `git commit -m "chore: add audit, runbooks, and release hardening"`

## Delivery Sequence

1. **Milestone A:** Task 1-3. Public read-only system with real data and expense detail pages.
2. **Milestone B:** Task 4. Admin authentication and terms management.
3. **Milestone C:** Task 5-6. Real sponsor payments plus TMS moderation.
4. **Milestone D:** Task 7-8. Expense evidence management, refunds, and campaign closeout.
5. **Milestone E:** Task 9. Audit, launch runbook, end-to-end verification, and release hardening.

## Exit Criteria

- Public users can see a live funding summary, pledge list, expense list, and expense detail evidence.
- Admins can log in, manage terms, review moderation results, edit expense evidence, and run both single and proportional refunds.
- ZPAY payment callbacks and refund callbacks are idempotent and fully auditable.
- Tencent Cloud TMS gates all public nickname/message publication.
- Closing the campaign disables new sponsorships and produces a reproducible proportional refund result from the stored snapshot.
- `pnpm check` and the full Playwright suite pass on the release candidate branch.
