/**
 * AI名刺 プラン定義
 *
 * FREE  : 無料（名刺1枚・ペルソナ1個・初回15万トークンのみ）
 * SOLO  : ¥980/月（名刺2枚・ペルソナ2個・月30万トークン）
 * GROWTH: ¥2,980/月（名刺5枚・ペルソナ5個・月100万トークン）
 * SCALE : ¥9,800/月（無制限・月400万トークン）
 */

export type PlanId = 'free' | 'solo' | 'growth' | 'scale'

export type Plan = {
  id: PlanId
  name: string
  priceJpy: number
  maxCards: number       // -1 = 無制限
  maxPersonas: number    // -1 = 無制限
  monthlyTokens: number  // 0 = サブスクなし
  features: {
    sessionAnalysis:   boolean
    pushNotifications: boolean
    monthlyReport:     boolean
    prioritySupport:   boolean
  }
  badge?: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id:            'free',
    name:          'フリー',
    priceJpy:      0,
    maxCards:      1,
    maxPersonas:   1,
    monthlyTokens: 0,    // 初回15万トークンボーナスのみ（credits.ts で管理）
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     false,
      prioritySupport:   false,
    },
  },
  solo: {
    id:            'solo',
    name:          'SOLO',
    priceJpy:      980,
    maxCards:      2,
    maxPersonas:   2,
    monthlyTokens: 300_000,   // 30万/月
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     false,
      prioritySupport:   false,
    },
    badge: '人気',
  },
  growth: {
    id:            'growth',
    name:          'GROWTH',
    priceJpy:      2_980,
    maxCards:      5,
    maxPersonas:   5,
    monthlyTokens: 1_000_000,  // 100万/月
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     true,
      prioritySupport:   false,
    },
  },
  scale: {
    id:            'scale',
    name:          'SCALE',
    priceJpy:      9_800,
    maxCards:      -1,
    maxPersonas:   -1,
    monthlyTokens: 4_000_000,  // 400万/月
    features: {
      sessionAnalysis:   true,
      pushNotifications: true,
      monthlyReport:     true,
      prioritySupport:   true,
    },
  },
}

/** Stripe Price ID ↔ PlanId の対応（環境変数から取得） */
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

/** カード上限チェック */
export function canAddCard(plan: PlanId, currentCount: number): boolean {
  const limit = PLANS[plan].maxCards
  return limit === -1 || currentCount < limit
}

/** ペルソナ上限チェック */
export function canAddPersona(plan: PlanId, currentCount: number): boolean {
  const limit = PLANS[plan].maxPersonas
  return limit === -1 || currentCount < limit
}

/** プランの表示色 */
export const PLAN_COLORS: Record<PlanId, { bg: string; text: string; border: string }> = {
  free:   { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  solo:   { bg: '#FFF0E8', text: '#F26722', border: '#F26722' },
  growth: { bg: '#EDE9FE', text: '#7C3AED', border: '#7C3AED' },
  scale:  { bg: '#FEF9C3', text: '#92400E', border: '#F59E0B' },
}
