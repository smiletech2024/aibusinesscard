/**
 * AI名刺 トークン課金ユーティリティ
 *
 * 料金体系:
 *   ChatGPT-4o API価格の2.5倍をユーザー請求単価として採用
 *   ・入力トークン: $2.50/1M × 2.5 = $6.25/1M = ¥0.0009375/token (¥150/$)
 *   ・出力トークン: $10.00/1M × 2.5 = $25.00/1M = ¥0.00375/token
 *
 * 実際のAPI原価（DeepSeek-V3）:
 *   ・入力: $0.27/1M = ¥0.0000405/token
 *   ・出力: $1.10/1M = ¥0.000165/token
 *   → 請求単価 / 原価 ≈ 約23倍のマージン
 *
 * DB単位:
 *   balance / amount は実際のAPIトークン数をそのまま格納
 *   （入力・出力の区別なく、prompt_tokens + completion_tokens の合計を消費）
 */

// ─── 料金定数 ───────────────────────────────────────────────────

/** ¥150 / $1 */
const YEN_PER_USD = 150

/** GPT-4o input: $2.50/1M × 2.5 */
export const INPUT_YEN_PER_TOKEN = (2.50 * 2.5 * YEN_PER_USD) / 1_000_000

/** GPT-4o output: $10.00/1M × 2.5 */
export const OUTPUT_YEN_PER_TOKEN = (10.00 * 2.5 * YEN_PER_USD) / 1_000_000

// ─── 購入パッケージ定義 ──────────────────────────────────────────

export type CreditPackage = {
  id: string
  name: string
  priceJpy: number
  tokens: number         // 付与トークン数
  bonusLabel?: string    // "+10%" など
  popular?: boolean
}

/**
 * ブレンド単価（入力70%/出力30%想定）= ¥0.001781/token
 * パッケージトークン数 = 価格 ÷ ブレンド単価 × ボーナス倍率
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id:       'starter',
    name:     'S',
    priceJpy: 500,
    tokens:   280_000,          // 28万トークン
  },
  {
    id:       'standard',
    name:     'M',
    priceJpy: 1_000,
    tokens:   620_000,          // 62万トークン (+10%ボーナス)
    bonusLabel: '+10%',
    popular:  true,
  },
  {
    id:       'pro',
    name:     'L',
    priceJpy: 3_000,
    tokens:   2_000_000,        // 200万トークン (+19%ボーナス)
    bonusLabel: '+19%',
  },
  {
    id:       'business',
    name:     'LL',
    priceJpy: 5_000,
    tokens:   3_600_000,        // 360万トークン (+28%ボーナス)
    bonusLabel: '+28%',
  },
]

/** 新規ユーザー向け初回ボーナストークン数 */
export const NEW_USER_BONUS_TOKENS = 150_000   // 15万トークン ≈ 約100回の会話

/**
 * 1回の会話あたりの平均トークン消費数
 * （質問3〜5往復 × 入出力合計 ≈ 約1,500トークン）
 */
export const TOKENS_PER_CONVERSATION = 1_500

/** トークン数 → 会話回数目安に変換 */
export function tokensToConversations(tokens: number): string {
  if (tokens === 0) return '0'
  const count = Math.floor(tokens / TOKENS_PER_CONVERSATION)
  if (count >= 10_000) return `${Math.floor(count / 10_000)}万回以上`
  if (count >= 1_000)  return `約${Math.round(count / 100) * 100}回`
  if (count >= 100)    return `約${Math.round(count / 10) * 10}回`
  return `約${count}回`
}

// ─── ヘルパー関数 ────────────────────────────────────────────────

/**
 * API使用量 → 消費トークン数を計算
 * （DBには prompt + completion の合計を記録するシンプル方式）
 */
export function calcTokensConsumed(promptTokens: number, completionTokens: number): number {
  return promptTokens + completionTokens
}

/**
 * 消費トークン数 → 日本円換算（表示用）
 */
export function tokensToYen(promptTokens: number, completionTokens: number): number {
  return (
    promptTokens     * INPUT_YEN_PER_TOKEN +
    completionTokens * OUTPUT_YEN_PER_TOKEN
  )
}

/**
 * トークン残高の表示フォーマット
 *  150000  → "15万"
 *  2000000 → "200万"
 *  800     → "800"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 10_000) {
    const man = tokens / 10_000
    return `${Math.floor(man)}万`
  }
  return tokens.toLocaleString('ja-JP')
}

/**
 * 残高が少ない場合の警告レベル
 */
export function getBalanceLevel(balance: number): 'ok' | 'low' | 'empty' {
  if (balance <= 0)      return 'empty'
  if (balance < 30_000)  return 'low'    // 3万トークン未満
  return 'ok'
}
