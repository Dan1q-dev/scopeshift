-- Real project text is private to a signed anonymous scope. Never expose these tables to browser clients.
CREATE TABLE IF NOT EXISTS scopeshift_real_projects (
  id uuid PRIMARY KEY,
  scope_hash text NOT NULL CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 10),
  revision integer NOT NULL CHECK (revision > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 524288),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_hash, slot)
);

CREATE INDEX IF NOT EXISTS scopeshift_real_projects_scope_updated_idx
  ON scopeshift_real_projects (scope_hash, updated_at DESC);

CREATE TABLE IF NOT EXISTS scopeshift_real_requests (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES scopeshift_real_projects(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 20),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('pending', 'ready', 'confirmed', 'failed')),
  owner_token uuid NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 3145728),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slot)
);

CREATE INDEX IF NOT EXISTS scopeshift_real_requests_project_updated_idx
  ON scopeshift_real_requests (project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS scopeshift_real_drafts (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES scopeshift_real_requests(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 20),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  review_revision integer NOT NULL CHECK (review_revision > 0),
  impact_hash text NOT NULL CHECK (impact_hash ~ '^[a-f0-9]{64}$'),
  input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  style text NOT NULL CHECK (style IN ('friendly', 'professional', 'firm')),
  status text NOT NULL CHECK (status IN ('pending', 'complete', 'failed')),
  owner_token uuid NOT NULL,
  data jsonb CHECK (data IS NULL OR (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 131072)),
  error jsonb CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, slot),
  CHECK ((status = 'pending' AND data IS NULL AND error IS NULL)
    OR (status = 'complete' AND data IS NOT NULL AND error IS NULL)
    OR (status = 'failed' AND data IS NULL AND error IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS scopeshift_real_drafts_request_updated_idx
  ON scopeshift_real_drafts (request_id, updated_at DESC);
