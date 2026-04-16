CREATE TABLE IF NOT EXISTS login_attempts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier   text NOT NULL,          -- email or IP
  attempts     int  NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt timestamptz DEFAULT now(),
  UNIQUE(identifier)
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- service role のみアクセス可
