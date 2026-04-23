-- agent_matches にカードIDカラムを追加
-- 送信済みマッチで相手のカードページへ直接アクセスできるようにする

alter table public.agent_matches
  add column if not exists skill_user_card_id uuid references public.business_cards(id) on delete set null,
  add column if not exists need_user_card_id  uuid references public.business_cards(id) on delete set null;
