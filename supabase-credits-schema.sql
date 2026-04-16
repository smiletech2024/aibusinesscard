-- AI名刺 クレジット（トークン）課金スキーマ
-- Supabase SQLエディタで実行してください

-- ─── ユーザートークン残高テーブル ───────────────────────────────
create table if not exists user_credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    bigint not null default 0,          -- 残高（APIトークン単位）
  total_purchased bigint not null default 0,     -- 累計購入トークン
  total_used      bigint not null default 0,     -- 累計使用トークン
  updated_at timestamp with time zone default now()
);

-- ─── トークン取引ログテーブル ────────────────────────────────────
create table if not exists credit_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  amount            bigint not null,              -- 正=付与 / 負=消費
  type              text not null,                -- 'bonus' | 'purchase' | 'usage'
  description       text,                         -- 表示用ラベル
  stripe_session_id text,                         -- Stripe決済ID（購入時）
  prompt_tokens     integer,                      -- 入力トークン数（usage時）
  completion_tokens integer,                      -- 出力トークン数（usage時）
  persona_id        uuid,                         -- どの分身AIの会話か（usage時）
  created_at        timestamp with time zone default now()
);

-- ─── RLSポリシー ────────────────────────────────────────────────
alter table user_credits enable row level security;
alter table credit_transactions enable row level security;

-- user_credits: 本人のみ読み書き可（サービスロールはすべて可）
create policy "Users can view own credits" on user_credits
  for select using (auth.uid() = user_id);

create policy "Service role manages credits" on user_credits
  for all using (true);

-- credit_transactions: 本人のみ参照可
create policy "Users can view own transactions" on credit_transactions
  for select using (auth.uid() = user_id);

create policy "Service role manages transactions" on credit_transactions
  for all using (true);

-- ─── 残高更新タイムスタンプトリガー ─────────────────────────────
create or replace function update_credits_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_credits_updated
  before update on user_credits
  for each row execute procedure update_credits_timestamp();
