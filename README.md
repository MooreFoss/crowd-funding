# Crowd Funding

Production-ready Next.js crowdfunding system for one campaign lifecycle: public funding display, ZPAY WeChat H5 sponsorship, Tencent Cloud TMS text moderation, expense evidence, admin terms, refunds, closeout, and audit logs.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm check
```

`pnpm check` is the stable pre-release gate: lint, production build, and unit tests.

## Runtime

Copy `.env.example` to `.env.local` and fill PostgreSQL, admin, ZPAY, Tencent TMS, and MinIO values. Apply SQL migrations from `src/infrastructure/persistence/migrations` in filename order before starting the app.

The app stores authoritative finance data in PostgreSQL. Amounts are stored in fen, public values are derived from pledge/refund/expense records, and payment/refund callbacks are designed to be idempotent.

## Release

See `docs/runbooks/production.md` for migration order, callback setup, key rotation, evidence storage, backup expectations, and launch smoke checks.
