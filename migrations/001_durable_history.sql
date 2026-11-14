-- Apply once before deploying the Postgres adapter. All runtime access is server-side.
CREATE TABLE IF NOT EXISTS scopeshift_replay_receipts (
  key text PRIMARY KEY CHECK (key ~ '^[a-f0-9]{64}$'),
  identity jsonb NOT NULL CHECK (jsonb_typeof(identity) = 'object' AND octet_length(identity::text) <= 8192),
  status text NOT NULL CHECK (status IN ('pending', 'complete')),
  owner_token uuid NOT NULL,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    (status = 'pending' AND receipt IS NULL AND completed_at IS NULL)
    OR (status = 'complete' AND receipt IS NOT NULL AND completed_at IS NOT NULL)
  ),
  CHECK (receipt IS NULL OR (jsonb_typeof(receipt) = 'object' AND octet_length(receipt::text) <= 65536))
);

CREATE INDEX IF NOT EXISTS scopeshift_replay_receipts_created_idx ON scopeshift_replay_receipts (created_at);

CREATE TABLE IF NOT EXISTS scopeshift_attempts (
  scope_hash text NOT NULL CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  scenario_id text NOT NULL,
  attempt_id text NOT NULL,
  history jsonb NOT NULL CHECK (jsonb_typeof(history) = 'array'),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_hash, scenario_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS scopeshift_attempts_scope_updated_idx ON scopeshift_attempts (scope_hash, scenario_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS scopeshift_ai_daily_usage (
  day date PRIMARY KEY,
  calls integer NOT NULL CHECK (calls >= 0)
);
