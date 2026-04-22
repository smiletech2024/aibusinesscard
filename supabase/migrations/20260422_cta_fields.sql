-- CTA（成約への導線）ボタンフィールドを business_cards に追加
alter table public.business_cards
  add column if not exists cta_label text,
  add column if not exists cta_url   text;
