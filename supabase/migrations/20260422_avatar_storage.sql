-- avatars ストレージバケット作成
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- 誰でも閲覧可（公開バケット）
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- 認証済みユーザーは自分のファイルをアップロード可
create policy "avatars_auth_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid() is not null
    and name = auth.uid()::text || '.jpg'
  );

-- 自分のファイルを上書き可
create policy "avatars_auth_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid() is not null
    and name = auth.uid()::text || '.jpg'
  );

-- 自分のファイルを削除可
create policy "avatars_auth_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid() is not null
    and name = auth.uid()::text || '.jpg'
  );
