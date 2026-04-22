-- アポイントテーブル
CREATE TABLE IF NOT EXISTS appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id           uuid NOT NULL REFERENCES business_cards(id) ON DELETE CASCADE,
  customer_name     text NOT NULL,
  customer_email    text,
  customer_phone    text,
  preferred_date    date,
  preferred_time    text,           -- '10:00', '14:00' など
  message           text,
  status            text NOT NULL DEFAULT 'pending',  -- pending / confirmed / cancelled
  owner_note        text,           -- 本人メモ
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 誰でも作成可（QRスキャンした人）
CREATE POLICY "anyone can create appointment"
  ON appointments FOR INSERT
  WITH CHECK (true);

-- カードオーナーだけが読める
CREATE POLICY "owner can read own appointments"
  ON appointments FOR SELECT
  USING (
    card_id IN (
      SELECT id FROM business_cards WHERE user_id = auth.uid()
    )
  );

-- カードオーナーだけが更新できる（確認・キャンセル）
CREATE POLICY "owner can update own appointments"
  ON appointments FOR UPDATE
  USING (
    card_id IN (
      SELECT id FROM business_cards WHERE user_id = auth.uid()
    )
  );
