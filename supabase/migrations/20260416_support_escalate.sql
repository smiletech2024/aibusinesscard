ALTER TABLE support_sessions ADD COLUMN IF NOT EXISTS escalated boolean DEFAULT false;
ALTER TABLE support_sessions ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
