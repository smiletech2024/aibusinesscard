# AI名刺アプリ セットアップガイド

## 概要
「名刺を起点に、分身AIが顧客との対話を蓄積し、本人と顧客の会話までつなぐ営業OS」

## 技術スタック
- **Next.js 14** (App Router + TypeScript)
- **Supabase** (PostgreSQL + Auth + Storage)
- **Claude API** (claude-opus-4-6, streaming)
- **Tailwind CSS**
- **qrcode** (QRコード生成)

## セットアップ手順

### 1. Supabaseプロジェクト作成
1. [Supabase](https://supabase.com) でプロジェクトを作成
2. `supabase-schema.sql` をSQL Editorで実行
3. Settings > API からキーを取得

### 2. 環境変数設定
`.env.local` を以下の実際の値に更新：
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 起動
```bash
npm run dev
```

## 画面構成（5画面）

| URL | 役割 |
|-----|------|
| `/` | ランディングページ |
| `/auth/login` | ログイン・新規登録 |
| `/setup` | ヒアリングAI（分身作成） |
| `/dashboard` | オーナーダッシュボード |
| `/card/[cardId]` | AI名刺（顧客向けQRページ） |
| `/chat/[sessionId]` | 顧客 × 分身AIチャット |
| `/summary/[sessionId]` | 会話まとめ |
| `/owner/chat/[sessionId]` | 顧客 × 本人チャット |
| `/print/[cardId]` | 名刺印刷デザイン（3種類） |

## ユーザーフロー

### オーナー側
1. `/auth/login` で登録
2. `/setup` でヒアリングAIと会話 → 分身AI作成
3. 名刺情報入力（氏名・肩書き・会社など）
4. `/dashboard` でQRコード確認・顧客セッション管理

### 顧客側
1. QRコードをスキャン → `/card/[cardId]`
2. 名前入力（任意）
3. `/chat/[sessionId]` で分身AIと会話
4. `/summary/[sessionId]` で会話まとめ確認
5. `/owner/chat/[sessionId]` で本人とチャット

## Claude API統合
- **ヒアリングAI** (`/api/hearing`): ストリーミング
- **分身AIチャット** (`/api/ai-chat`): ストリーミング
- **会話要約** (`/api/summarize`): JSON構造化出力
- **ペルソナ抽出** (`/api/persona`): 会話からJSONデータ抽出

## DBスキーマ
- `profiles` - ユーザー情報
- `personas` - AI分身設定（価値観・FAQ・実績・NG事項）
- `business_cards` - 名刺情報・QRリンク
- `customer_sessions` - 顧客セッション
- `ai_conversations` - AI会話ログ
- `conversation_summaries` - 会話まとめ（目的・悩み・相性・次アクション）
- `human_chats` - 本人×顧客チャット
