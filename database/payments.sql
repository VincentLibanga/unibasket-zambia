-- Hosted checkout records are private to the Express server.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  reference VARCHAR(40) PRIMARY KEY,
  request_hash CHAR(64) NOT NULL UNIQUE,
  fingerprint CHAR(64) NOT NULL,
  mode VARCHAR(4) NOT NULL CHECK (mode IN ('test', 'live')),
  details JSONB NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  initialization VARCHAR(12) NOT NULL DEFAULT 'new' CHECK (initialization IN ('new', 'starting', 'ready', 'uncertain')),
  checkout_url TEXT,
  payment_status VARCHAR(7) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'failed', 'paid')),
  transaction_id VARCHAR(80) UNIQUE,
  verified_at TIMESTAMPTZ,
  receipt_sending_at TIMESTAMPTZ,
  receipt_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
