CREATE TABLE IF NOT EXISTS expense_evidence (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  asset_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'AUDIT_ONLY')) DEFAULT 'PUBLIC',
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_evidence_expense_id_sort_order
  ON expense_evidence(expense_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS moderation_reviews (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('PLEDGE', 'PLEDGE_EDIT')),
  subject_id TEXT NOT NULL,
  field_name TEXT NOT NULL CHECK (field_name IN ('DISPLAY_NAME', 'MESSAGE')),
  provider TEXT NOT NULL DEFAULT 'TENCENT_TMS',
  request_id TEXT,
  submitted_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVIEW_ERROR')),
  failure_summary TEXT,
  reviewed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_reviews_request_id
  ON moderation_reviews(request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_moderation_reviews_subject
  ON moderation_reviews(subject_type, subject_id, created_at DESC);
