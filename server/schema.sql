-- MoiJournal schema. Journal content is stored ONLY as client-side ciphertext (bytea).
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username       text UNIQUE NOT NULL,
  auth_hash      text NOT NULL,
  recovery_hash  text NOT NULL,
  keys           jsonb NOT NULL,
  profile        bytea NOT NULL,
  theme          text NOT NULL DEFAULT 'blush',
  plan           text NOT NULL DEFAULT 'free',
  token_version  int  NOT NULL DEFAULT 0,
  failed         int  NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        bytea NOT NULL,
  cover       bytea,
  color       text NOT NULL DEFAULT 'blush',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_user_idx ON books(user_id);

CREATE TABLE IF NOT EXISTS pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pages_book_idx ON pages(book_id);
CREATE INDEX IF NOT EXISTS pages_user_idx ON pages(user_id);
