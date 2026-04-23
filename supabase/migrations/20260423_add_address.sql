-- business_cards に住所カラムを追加
alter table business_cards add column if not exists address text;
