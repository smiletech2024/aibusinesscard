/**
 * AI名刺 トークン課金ユーティリティ
 *
 * 料金体系:
 *   ChatGPT-4o API価格の1.2倍をユーザー請求単価として採用
 *   ・入力トークン: $2.50/1M × 1.2 = $3.00/1M = ¥0.00045/token (¥150/$)
 *   ・出力トークン: $10.00/1M × 1.2 = $12.00/1M = ¥0.0018/token
 *
 * DB単位:
 *   balance / amount は実際のAPIトークン数をそのまま格納
 *   （入力・出力の区別なく、prompt_tokens + completion_tokens の合計を消費）
 */

// ─── 料金定数 ───────────────────────────────────────────────────

/** ¥150 / $1 */
const YEN_PER_USD = 150

/** GPT-4o input: $2.50/1M × 1.2 */
export const INPUT_YEN_PER_TOKEN = (2.50 * 1.2 * YEN_PER_USD) / 1_000_000

/** GPT-4o output: $10.00/1M × 1.2 */
export const OUTPUT_YEN_PER_TOKEN = (10.00 * 1.2 * YEN_PER_USD) / 1_000_000

// ─── 購入パッケージ定義 ──────────────────────────────────────────

export type CreditPackage = {
  id: string
  name: string
  priceJpy: number
  tokens: number         // 付与トークン数
  bonusLabel?: string    // "10%おまけ" など
  popular?: boolean
}

/** ¥0.001125/token（入出力ブレンド）を基準に多少のボーナスを追加 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id:       'starter',
    name:     'スターター',
    priceJpy: 500,
    tokens:   500_000,          // 50万トークン
  },
  {
    id:       'standard',
    name:     'スタンダード',
    priceJpy: 1_000,
    tokens:   1_100_000,        // 110万トークン (+10%ボーナス)
    bonusLabel: '+10%',
    popular:  true,
  },
  {
    id:       'pro',
    name:     'プロ',
    priceJpy: 3_000,
    tokens:   3_600_000,        // 360万トークン (+20%ボーナス)
    bonusLabel: '+20%',
  },
  {
    id:       'business',
    name:     'ビジネス',
    priceJpy: 5_000,
    tokens:   6_500_000,        // 650万トークン (+30%ボーナス)
    bonusLabel: '+30%',
  },
]

/** 新規ユーザー向け初回ボーナストークン数 */
export const NEW_USER_BONUS_TOKENS = 300_000   // 30万トークン ≈ 150〜300回の会話

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
    promptTokens    * INPUT_YEN_PER_TOKEN +
    completionTokens * OUTPUT_YEN_PER_TOKEN
  )
}

/**
 * トークン残高の表示フォーマット
 *  300000  → "30万"
 *  1500000 → "150万"
 *  800     → "800"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const man = tokens / 10_000
    return `${Math.floor(man)}万`
  }
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
  if (balance <= 0)       return 'empty'
  if (balance < 50_000)  return 'low'    // 5万トークン未満
  return 'ok'
}
