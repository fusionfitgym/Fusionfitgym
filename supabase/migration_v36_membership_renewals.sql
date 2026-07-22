-- ============================================================
-- Migration V36: Membership Renewals Table & RLS Policies
-- ============================================================

CREATE TABLE IF NOT EXISTS membership_renewals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,
  renewal_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_package    TEXT NOT NULL,
  new_package         TEXT NOT NULL,
  previous_start_date DATE,
  previous_end_date   DATE,
  new_start_date      DATE NOT NULL,
  new_end_date        DATE NOT NULL,
  invoice_number      TEXT,
  amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount            NUMERIC(10,2) DEFAULT 0,
  payment_method      TEXT,
  renewed_by          TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance when querying member renewals
CREATE INDEX IF NOT EXISTS idx_membership_renewals_member_id ON membership_renewals(member_id);
CREATE INDEX IF NOT EXISTS idx_membership_renewals_renewal_date ON membership_renewals(renewal_date);

-- Enable RLS
ALTER TABLE membership_renewals ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and insert renewals
CREATE POLICY "Allow authenticated view membership_renewals"
  ON membership_renewals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert membership_renewals"
  ON membership_renewals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update membership_renewals"
  ON membership_renewals FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete membership_renewals"
  ON membership_renewals FOR DELETE
  TO authenticated
  USING (true);
