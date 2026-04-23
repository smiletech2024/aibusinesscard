-- push_subscriptions に user_id カラムを追加（オーナー向けユーザーレベル通知用）
alter table push_subscriptions alter column session_id drop not null;
alter table push_subscriptions add column if not exists user_id uuid references profiles(id) on delete cascade;
