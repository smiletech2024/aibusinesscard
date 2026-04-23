-- ================================================================
-- AI名刺 セキュリティ&品質改善マイグレーション v3
-- Supabase Dashboard > SQL Editor で実行してください
-- ================================================================

-- ----------------------------------------------------------------
-- 1. RLS ポリシーの修正
--    "using (true)" を ownership ベースに書き直す
-- ----------------------------------------------------------------

-- customer_sessions
DROP POLICY IF EXISTS "Anyone can read sessions"  ON customer_sessions;
DROP POLICY IF EXISTS "Anyone can update sessions" ON customer_sessions;

CREATE POLICY "Owners can read own sessions" ON customer_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM personas p
      WHERE p.id = persona_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own sessions" ON customer_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM personas p
      WHERE p.id = persona_id AND p.user_id = auth.uid()
    )
  );

-- ai_conversations
DROP POLICY IF EXISTS "Anyone can manage ai conversations" ON ai_conversations;

CREATE POLICY "Owners can read own conversations" ON ai_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customer_sessions cs
      JOIN personas p ON p.id = cs.persona_id
      WHERE cs.id = session_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own conversations" ON ai_conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM customer_sessions cs
      JOIN personas p ON p.id = cs.persona_id
      WHERE cs.id = session_id AND p.user_id = auth.uid()
    )
  );

-- Insert は API Route (service role) 経由なので RLS は不要だが保険として残す
CREATE POLICY "Anyone can insert conversations" ON ai_conversations
  FOR INSERT WITH CHECK (true);

-- conversation_summaries（DROP 抜け修正）
DROP POLICY IF EXISTS "Anyone can manage summaries" ON conversation_summaries;

CREATE POLICY "Owners can read own summaries" ON conversation_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customer_sessions cs
      JOIN personas p ON p.id = cs.persona_id
      WHERE cs.id = session_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert summaries" ON conversation_summaries
  FOR INSERT WITH CHECK (true);

-- human_chats
DROP POLICY IF EXISTS "Anyone can manage human chats" ON human_chats;

CREATE POLICY "Owners can read own human chats" ON human_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customer_sessions cs
      JOIN personas p ON p.id = cs.persona_id
      WHERE cs.id = session_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert human chats" ON human_chats
  FOR INSERT WITH CHECK (true);

-- ----------------------------------------------------------------
-- 2. compatibility_score を TEXT → INTEGER に変換
-- ----------------------------------------------------------------
ALTER TABLE conversation_summaries
  ALTER COLUMN compatibility_score TYPE integer
  USING CASE
    WHEN compatibility_score ~ '^\d+$' THEN compatibility_score::integer
    ELSE NULL
  END;

-- ----------------------------------------------------------------
-- 3. credit_transactions に stripe_event_id / stripe_subscription_id 追加
--    イベント単位・サブスク単位の二重付与を構造的に防ぐ
-- ----------------------------------------------------------------
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS stripe_event_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_stripe_event
  ON credit_transactions(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- サブスク+期間ベースの冪等性インデックス（checkout と subscription.created の二重発火防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_sub_period
  ON credit_transactions(stripe_subscription_id, DATE_TRUNC('month', created_at))
  WHERE stripe_subscription_id IS NOT NULL AND type = 'bonus';

-- ----------------------------------------------------------------
-- 4. customer_sessions に expires_at 追加（セッション有効期限）
-- ----------------------------------------------------------------
ALTER TABLE customer_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 既存セッションの有効期限を作成日 +24h に設定
UPDATE customer_sessions
  SET expires_at = created_at + INTERVAL '24 hours'
  WHERE expires_at IS NULL;

-- ----------------------------------------------------------------
-- 5. 原子的トークン消費 RPC 関数
--    FOR UPDATE ロックで競合状態（race condition）を解消
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id  UUID,
  p_consumed BIGINT
) RETURNS void AS $$
DECLARE
  v_from_sub  BIGINT;
  v_from_paid BIGINT;
BEGIN
  -- 行ロックで同一ユーザーの並列リクエストを直列化
  PERFORM 1 FROM user_credits WHERE user_id = p_user_id FOR UPDATE;

  -- サブスク残高を先に消費し、不足分は購入残高から
  SELECT
    LEAST(sub_balance, p_consumed),
    GREATEST(0::BIGINT, p_consumed - LEAST(sub_balance, p_consumed))
  INTO v_from_sub, v_from_paid
  FROM user_credits WHERE user_id = p_user_id;

  UPDATE user_credits SET
    sub_balance = GREATEST(0, sub_balance - v_from_sub),
    balance     = GREATEST(0, balance     - v_from_paid),
    total_used  = total_used + p_consumed
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- 6. パフォーマンス改善インデックス
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customer_sessions_persona_created
  ON customer_sessions(persona_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires
  ON customer_sessions(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_created
  ON ai_conversations(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_personas_user_id
  ON personas(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON credit_transactions(user_id, created_at DESC);
