-- AI名刺 フィードバック（意見箱）スキーマ
-- Supabase SQL エディタで実行してください

CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL DEFAULT 'general',  -- 'bug' | 'feature' | 'general'
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のフィードバックのみ投稿・閲覧可
CREATE POLICY "users can insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can read own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

-- サービスロールはすべて操作可（管理画面用）
CREATE POLICY "service role manages feedback"
  ON public.feedback FOR ALL
  USING (true);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_is_read_idx ON public.feedback(is_read) WHERE is_read = FALSE;
