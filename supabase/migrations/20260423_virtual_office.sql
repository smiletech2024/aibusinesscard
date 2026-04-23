-- バーチャルオフィス スロット
create table if not exists virtual_office_slots (
  id            uuid primary key default gen_random_uuid(),
  area          text not null check (area in ('kanto', 'kansai')),
  floor_num     int  not null check (floor_num between 1 and 7),
  slot_num      int  not null check (slot_num between 1 and 3),
  user_id       uuid references auth.users(id) on delete set null,
  card_id       uuid references business_cards(id) on delete set null,
  company_name  text,
  display_name  text,
  card_title    text,
  occupied_at   timestamptz,
  created_at    timestamptz default now(),
  constraint unique_area_floor_slot unique (area, floor_num, slot_num)
);

alter table virtual_office_slots enable row level security;

-- 全員が読み取り可能
create policy "public_read_virtual_office_slots"
  on virtual_office_slots for select
  using (true);

-- 全42スロットを事前作成（空き状態）
insert into virtual_office_slots (area, floor_num, slot_num)
select a.area, f.floor_num, s.slot_num
from (values ('kanto'::text), ('kansai'::text)) as a(area)
cross join generate_series(1, 7) as f(floor_num)
cross join generate_series(1, 3) as s(slot_num)
on conflict (area, floor_num, slot_num) do nothing;
