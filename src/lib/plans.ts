/**
 * AI名刺 プラン定義（A+B+C ハイブリッド設計）
 *
 * A: FREE を意図的に不便にする
 *    - 月間セッション5件まで
 *    - チャット画面に「AI名刺で作成」ブランド表示
 *    - セッション分析は直近3件のみ
 *    - Push通知なし
 *
 * B: SOLO を ¥480 に下げる（「コーヒー1杯」の心理的ライン）
 *    - 月間60万トークン（パックより圧倒的にお得）
 *
 * C: サブスク = 安心保証
 *    - 月間トークン保証（切れても翌月リセット）
 *    - AI が止まらない安心感
 */

export type PlanId = 'free' | 'solo' | 'growth' | 'scale'

export type Plan = {
  id: PlanId
  name: string
  priceJpy: number
  maxCards: number              // -1 = 無制限
  maxPersonas: number           // -1 = 無制限
  maxSessionsPerMonth: number   // -1 = 無制限  ← A
  monthlyTokens: number         // 0 = サブスクなし
  showBranding: boolean         // チャット画面にブランド表示  ← A
  analysisHistoryLimit: number  // セッション分析の表示件数上限 (-1=全件)  ← A
  features: {
    sessionAnalysis:   boolean
    pushNotifications: boolean  // ← A: free は false
    monthlyReport:     boolean
    prioritySupport:   boolean
  }
  badge?: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id:                   'free',
    name:                 'フリー',
    priceJpy:             0,
    maxCards:             1,
    maxPersonas:          1,
    maxSessionsPerMonth:  15,         // 月15件まで（トライアル体験を改善）
    monthlyTokens:        0,
    showBranding:         true,       // A: ブランド表示あり
    analysisHistoryLimit: 3,          // A: 直近3件のみ
    features: {
      sessionAnalysis:   true,        // 閲覧はできる（ただし3件まで）
      pushNotifications: false,       // A: なし
      monthlyReport:     false,
      prioritySupport:   false,
    },
  },
  solo: {
    id:                   'solo',
    name:                 'スタンダード',
    priceJpy:             480,        // B: ¥480（コーヒー1杯）
    maxCards:             2,
    maxPersonas:          2,
    maxSessionsPerMonth:  -1,
    monthlyTokens:        600_000,    // B+C: 60万/月（全パックより安い）
    showBranding:         false,
    analysisHistoryLimit: -1,
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     false,
      prioritySupport:   false,
    },
    badge: '人気',
  },
  growth: {
    id:                   'growth',
    name:                 'ビジネス',
    priceJpy:             2_980,
    maxCards:             5,
    maxPersonas:          5,
    maxSessionsPerMonth:  -1,
    monthlyTokens:        2_200_000,  // 220万/月
    showBranding:         false,
    analysisHistoryLimit: -1,
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     true,
      prioritySupport:   false,
    },
  },
  scale: {
    id:                   'scale',
    name:                 'エンタープライズ',
    priceJpy:             9_800,
    maxCards:             -1,
    maxPersonas:          -1,
    maxSessionsPerMonth:  -1,
    monthlyTokens:        8_000_000,  // 800万/月
    showBranding:         false,
    analysisHistoryLimit: -1,
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     true,
      prioritySupport:   true,
    },
  },
}

/** トークン単価比較（全プランでサブスクがパックより安い） */
export const TOKEN_RATE_TABLE = [
  { label: 'エンタープライズ ¥9,800', rate: 9_800  / 8_000_000 },
  { label: 'ビジネス ¥2,980',        rate: 2_980  / 2_200_000 },
  { label: 'スタンダード ¥480',       rate: 480    / 600_000   },
  { label: '¥5,000パック',   rate: 5_000  / 3_600_000 },
  { label: '¥3,000パック',   rate: 3_000  / 2_000_000 },
  { label: '¥1,000パック',   rate: 1_000  / 620_000   },
  { label: '¥500パック',     rate: 500    / 280_000   },
]
// → SOLO が最も安いパック（¥5,000）より約70%割安

/** Stripe Price ID ↔ PlanId */
export function getPlanByPriceId(priceId: string): PlanId | null {
  if (priceId === process.env.STRIPE_PRICE_SOLO)   return 'solo'
  if (priceId === process.env.STRIPE_PRICE_GROWTH)  return 'growth'
  if (priceId === process.env.STRIPE_PRICE_SCALE)   return 'scale'
  return null
}

export function getPriceIdByPlan(planId: PlanId): string | null {
  if (planId === 'solo')   return process.env.STRIPE_PRICE_SOLO   ?? null
  if (planId === 'growth') return process.env.STRIPE_PRICE_GROWTH ?? null
  if (planId === 'scale')  return process.env.STRIPE_PRICE_SCALE  ?? null
  return null
}

export function canAddCard(plan: PlanId, currentCount: number): boolean {
  const limit = PLANS[plan].maxCards
  return limit === -1 || currentCount < limit
}

export function canAddPersona(plan: PlanId, currentCount: number): boolean {
  const limit = PLANS[plan].maxPersonas
  return limit === -1 || currentCount < limit
}

export function canStartSession(plan: PlanId, monthlyCount: number): boolean {
  const limit = PLANS[plan].maxSessionsPerMonth
  return limit === -1 || monthlyCount < limit
}

export const PLAN_COLORS: Record<PlanId, { bg: string; text: string; border: string }> = {
  free:   { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  solo:   { bg: '#FFF0E8', text: '#F26722', border: '#F26722' },
  growth: { bg: '#EDE9FE', text: '#7C3AED', border: '#7C3AED' },
  scale:  { bg: '#FEF9C3', text: '#92400E', border: '#F59E0B' },
}
