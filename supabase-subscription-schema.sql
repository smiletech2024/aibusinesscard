-- AI名刺 サブスクリプション管理スキーマ
-- supabase-credits-schema.sql を先に実行してください
-- Supabase SQLエディタで実行

-- ─── サブスクリプション情報テーブル ─────────────────────────────
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL DEFAULT 'free',   -- 'free'|'solo'|'growth'|'scale'
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  status                 TEXT NOT NULL DEFAULT 'active', -- 'active'|'canceled'|'past_due'|'trialing'
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─── user_credits に月次サブスクトークン列を追加 ─────────────────
-- sub_balance  : サブスクの月次割当残高（毎月リセット）
-- sub_reset_at : 直近リセット日時
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS sub_balance  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sub_reset_at TIMESTAMPTZ;

-- ─── RLS ──────────────────────────────────────────────────────────
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions" ON user_subscriptions
  FOR ALL USING (true);

-- ─── タイムスタンプ自動更新トリガー ─────────────────────────────
CREATE OR REPLACE FUNCTION update_subscriptions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_subscription_updated
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE update_subscriptions_timestamp();

-- ─── 新規ユーザー登録時に free サブスクレコードを自動作成 ─────
-- （auth.users トリガーはすでに profiles を作成するので、
--    同じ関数を拡張して user_subscriptions も作る）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- profiles の作成（既存）
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- user_subscriptions の作成（新規）
  INSERT INTO public.user_subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
