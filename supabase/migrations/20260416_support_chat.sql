-- サポートチャットセッション
CREATE TABLE IF NOT EXISTS support_sessions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_key text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_updated
  ON support_sessions(updated_at DESC);

-- サポートチャットメッセージ
CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_key text NOT NULL,
  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'operator')),
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_session
  ON support_messages(session_key, created_at);

-- RLS: service role のみ読み書き（anon は不可）
ALTER TABLE support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
