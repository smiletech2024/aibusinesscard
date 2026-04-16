ALTER TABLE support_sessions ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE support_sessions ADD COLUMN IF NOT EXISTS meeting_context text;
