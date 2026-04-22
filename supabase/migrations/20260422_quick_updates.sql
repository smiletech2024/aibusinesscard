-- quick_updates: スマホから一言送るだけでAIの知識に反映される仕組み
create table if not exists public.quick_updates (
  id         uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.quick_updates enable row level security;

-- オーナーのみ CRUD 可
create policy "owner_select" on public.quick_updates
  for select using (
    persona_id in (
      select id from public.personas where user_id = auth.uid()
    )
  );

create policy "owner_insert" on public.quick_updates
  for insert with check (
    persona_id in (
      select id from public.personas where user_id = auth.uid()
    )
  );

create policy "owner_delete" on public.quick_updates
  for delete using (
    persona_id in (
      select id from public.personas where user_id = auth.uid()
    )
  );

-- ai-chat API (anon) からも読めるようにする（分身AIがシステムプロンプトに組み込むため）
create policy "anon_select" on public.quick_updates
  for select using (true);
