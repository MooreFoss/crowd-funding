CREATE TABLE IF NOT EXISTS campaign_state (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CLOSING', 'REFUNDING', 'ENDED', 'SETTLED')),
  close_reason TEXT,
  close_snapshot JSONB,
  close_snapshot_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  refund_batch_no TEXT,
  refund_progress JSONB,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terms_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_versions_single_active
  ON terms_versions(status)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS pledges (
  id TEXT PRIMARY KEY,
  merchant_order_no TEXT NOT NULL UNIQUE,
  payment_channel TEXT NOT NULL,
  provider_order_no TEXT,
  user_key TEXT NOT NULL,
  submitted_name TEXT,
  public_name TEXT,
  submitted_message TEXT,
  public_message TEXT,
  amount_fen INTEGER NOT NULL CHECK (amount_fen >= 0),
  refunded_fen INTEGER NOT NULL DEFAULT 0 CHECK (refunded_fen >= 0),
  net_amount_fen INTEGER NOT NULL CHECK (net_amount_fen >= 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAYING', 'PAID', 'CANCELLED', 'FAILED', 'PARTIAL_REFUNDED', 'REFUNDED', 'CLOSED')),
  payment_redirect_url TEXT,
  terms_version_id TEXT REFERENCES terms_versions(id) ON DELETE SET NULL,
  terms_accepted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (refunded_fen <= amount_fen),
  CHECK (net_amount_fen = amount_fen - refunded_fen)
);

CREATE INDEX IF NOT EXISTS idx_pledges_created_at ON pledges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pledges_paid_at ON pledges(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_pledges_status_created_at ON pledges(status, created_at DESC);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  pledge_id TEXT NOT NULL REFERENCES pledges(id) ON DELETE RESTRICT,
  merchant_refund_no TEXT NOT NULL UNIQUE,
  provider_refund_no TEXT,
  batch_no TEXT,
  close_snapshot_id TEXT,
  allocation_order INTEGER,
  amount_fen INTEGER NOT NULL CHECK (amount_fen > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'PROCESSING', 'SUCCEEDED', 'REFUND_CLOSED', 'EXCEPTION')),
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_pledge_id_created_at ON refunds(pledge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_batch_no_created_at ON refunds(batch_no, created_at DESC);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  amount_fen INTEGER NOT NULL CHECK (amount_fen > 0),
  description TEXT NOT NULL,
  detail_visibility TEXT NOT NULL CHECK (detail_visibility IN ('PUBLIC', 'AUDIT_ONLY')) DEFAULT 'PUBLIC',
  created_by TEXT NOT NULL,
  voided_at TIMESTAMPTZ,
  voided_by TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ADMIN', 'SYSTEM', 'USER')),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_summary JSONB,
  after_summary JSONB,
  metadata JSONB,
  idempotency_key TEXT UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id, occurred_at DESC);
