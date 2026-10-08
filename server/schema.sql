-- MoiJournal schema. Journal content is stored ONLY as client-side ciphertext (bytea).
-- Applied on every API start, so every statement must be idempotent.
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

-- Added later: `premium_until` lets a paid plan lapse back to Free on its own, `is_admin`
-- marks who may open the admin dashboard, and `recovery_lookup` finds a username from a
-- recovery code without the code ever being stored.
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until     timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin          boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_lookup   text;
CREATE UNIQUE INDEX IF NOT EXISTS users_recovery_lookup_idx
  ON users(recovery_lookup) WHERE recovery_lookup IS NOT NULL;

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

-- UPI payments are manual: the user pays to the MoiJournal UPI ID and files a claim here,
-- an admin reviews it, and approving one extends the user's Premium. Nothing about a diary
-- is ever involved. `upi_id` is the payer's own VPA, kept as proof of who paid.
CREATE TABLE IF NOT EXISTS payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username      text NOT NULL,
  months        int  NOT NULL DEFAULT 1,
  amount_paise  int  NOT NULL,
  upi_id        text NOT NULL,
  utr           text,
  note          text,
  status        text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   text
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status, created_at DESC);
