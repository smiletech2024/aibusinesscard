-- AI名刺アプリ Supabaseスキーマ

-- ユーザー設定テーブル（auth.usersと連携）
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- 分身AI設定テーブル
create table if not exists personas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  values_summary text,
  tone_profile text,
  faq_json jsonb default '[]',
  achievements_json jsonb default '[]',
  forbidden_rules_json jsonb default '[]',
  routing_rules_json jsonb default '[]',
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 名刺テーブル
create table if not exists business_cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  persona_id uuid references personas(id),
  image_url text,
  full_name text not null,
  title text,
  company text,
  short_intro text,
  email text,
  phone text,
  website text,
  qr_url text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 顧客セッションテーブル
create table if not exists customer_sessions (
  id uuid default gen_random_uuid() primary key,
  persona_id uuid references personas(id) on delete cascade not null,
  card_id uuid references business_cards(id),
  customer_name text,
  customer_email text,
  status text default 'ai_chat', -- ai_chat, summarized, owner_chat, closed
  intent text,
  summary_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- AI会話ログテーブル
create table if not exists ai_conversations (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references customer_sessions(id) on delete cascade not null,
  role text not null, -- user, assistant
  content text not null,
  created_at timestamp with time zone default now()
);

-- 会話まとめテーブル
create table if not exists conversation_summaries (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references customer_sessions(id) on delete cascade not null,
  purpose text,
  problems text,
  interests text,
  compatibility_score text,
  unresolved_points text,
  next_action text,
  raw_summary text,
  created_at timestamp with time zone default now()
);

-- オーナー・顧客チャットテーブル
create table if not exists human_chats (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references customer_sessions(id) on delete cascade not null,
  sender_role text not null, -- owner, customer
  content text not null,
  created_at timestamp with time zone default now()
);

-- RLSポリシー設定
alter table profiles enable row level security;
alter table personas enable row level security;
alter table business_cards enable row level security;
alter table customer_sessions enable row level security;
alter table ai_conversations enable row level security;
alter table conversation_summaries enable row level security;
alter table human_chats enable row level security;

-- profilesのポリシー
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Service role can do all on profiles" on profiles for all using (true);

-- personasのポリシー
create policy "Users can manage own personas" on personas for all using (auth.uid() = user_id);
create policy "Anyone can read personas" on personas for select using (true);

-- business_cardsのポリシー
create policy "Users can manage own cards" on business_cards for all using (auth.uid() = user_id);
create policy "Anyone can read cards" on business_cards for select using (true);

-- customer_sessionsのポリシー
create policy "Anyone can create sessions" on customer_sessions for insert with check (true);
create policy "Anyone can read sessions" on customer_sessions for select using (true);
create policy "Anyone can update sessions" on customer_sessions for update using (true);

-- ai_conversationsのポリシー
create policy "Anyone can manage ai conversations" on ai_conversations for all using (true);

-- conversation_summariesのポリシー
create policy "Anyone can manage summaries" on conversation_summaries for all using (true);

-- human_chatsのポリシー
create policy "Anyone can manage human chats" on human_chats for all using (true);

-- 新規ユーザー登録時にprofileを自動作成するトリガー
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
