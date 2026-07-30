-- Ozone Unit website — database schema
-- Postgres (Supabase). Uses native BOOLEAN and TIMESTAMPTZ types, and
-- GENERATED ALWAYS AS IDENTITY instead of SQLite's AUTOINCREMENT.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',   -- 'admin' | 'editor'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',    -- 'new' | 'read' | 'archived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message TEXT NOT NULL,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Confidential reports: "location_enc", "details_enc" and "contact_enc" are
-- AES-256-GCM encrypted at rest (see db/crypto.js) — Postgres only ever
-- sees/stores base64 ciphertext, never plaintext.
CREATE TABLE IF NOT EXISTS confidential_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  location_enc TEXT,
  details_enc TEXT NOT NULL,
  contact_enc TEXT,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'under_review' | 'closed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,     -- 'Legislation' | 'Guidance' | 'Reports' | 'Forms'
  file_type TEXT NOT NULL,    -- 'PDF' | 'DOCX' | 'XLSX'
  file_url TEXT NOT NULL DEFAULT '#',
  is_new BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'Ministry News',
  body TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
