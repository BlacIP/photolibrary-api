CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONBOARDING',
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_clients (
  studio_id UUID NOT NULL,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  subheading TEXT,
  event_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (studio_id, client_id)
);

CREATE TABLE IF NOT EXISTS studio_client_stats (
  studio_id UUID NOT NULL,
  client_id UUID NOT NULL,
  photo_count INTEGER NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (studio_id, client_id)
);

CREATE TABLE IF NOT EXISTS studio_owners (
  studio_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (studio_id, owner_id),
  UNIQUE (studio_id, email)
);

CREATE INDEX IF NOT EXISTS studio_clients_studio_id_idx ON studio_clients (studio_id);
CREATE INDEX IF NOT EXISTS studio_client_stats_studio_id_idx ON studio_client_stats (studio_id);
CREATE INDEX IF NOT EXISTS studio_owners_studio_id_idx ON studio_owners (studio_id);
