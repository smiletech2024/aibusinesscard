-- ══════════════════════════════════════════════════════
--  AI Agent Matching System
--  Tables: user_needs / user_skills / agent_matches
-- ══════════════════════════════════════════════════════

-- ── 1. user_needs（課題テーブル） ──────────────────────
create table if not exists public.user_needs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  category      text        not null default 'other',
  title         text        not null,
  description   text        not null,
  ideal_outcome text,
  budget_range  text        not null default 'undisclosed',
  urgency       text        not null default 'no_limit',
  is_public     boolean     not null default true,
  is_active     boolean     not null default true,
  interview_log jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.user_needs enable row level security;

create policy "own needs: full access"
  on public.user_needs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "public needs: read only"
  on public.user_needs for select
  using (is_public = true and is_active = true);

-- ── 2. user_skills（スキルテーブル） ───────────────────
create table if not exists public.user_skills (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  category     text        not null default 'other',
  title        text        not null,
  description  text        not null,
  achievements text,
  ideal_client text,
  is_active    boolean     not null default true,
  interview_log jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.user_skills enable row level security;

create policy "own skills: full access"
  on public.user_skills for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "skills: readable by all auth users"
  on public.user_skills for select
  to authenticated
  using (is_active = true);

-- ── 3. agent_matches（マッチングテーブル） ─────────────
-- 表示に必要な情報を非正規化して格納（join不要・高速）
create table if not exists public.agent_matches (
  id               uuid        primary key default gen_random_uuid(),
  skill_user_id    uuid        not null references auth.users(id) on delete cascade,
  need_user_id     uuid        not null references auth.users(id) on delete cascade,
  skill_id         uuid        not null references public.user_skills(id) on delete cascade,
  need_id          uuid        not null references public.user_needs(id) on delete cascade,
  match_score      integer     not null default 0,
  match_reason     text        not null default '',
  approach_message text,
  status           text        not null default 'new',  -- new|interested|sent|replied|closed
  is_read          boolean     not null default false,
  -- 非正規化：skill側
  skill_title      text        not null default '',
  skill_category   text        not null default '',
  skill_user_name  text        not null default '',
  skill_user_company text               default '',
  skill_user_title_label text          default '',
  -- 非正規化：need側
  need_title       text        not null default '',
  need_category    text        not null default '',
  need_description text                 default '',
  need_budget      text                 default '',
  need_urgency     text                 default '',
  need_user_name   text        not null default '',
  need_user_company text                default '',
  need_user_title_label text           default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.agent_matches enable row level security;

-- スキル保有者：自分が探した案件を全操作
create policy "skill user: full access"
  on public.agent_matches for all
  using  (auth.uid() = skill_user_id)
  with check (auth.uid() = skill_user_id);

-- 課題保有者：送られてきた提案を閲覧・更新
create policy "need user: select"
  on public.agent_matches for select
  using (auth.uid() = need_user_id);

create policy "need user: update status"
  on public.agent_matches for update
  using (auth.uid() = need_user_id);
