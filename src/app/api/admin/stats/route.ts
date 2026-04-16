import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLANS, type PlanId } from '@/lib/plans'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ""

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  // 管理者チェック
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getAdmin()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    totalUsersResult,
    newThisMonthResult,
    newLastMonthResult,
    planDistResult,
    sessionsAllResult,
    sessionsThisMonthResult,
    sessionsDailyResult,
    activeUsersResult,
    tokenStatsResult,
    cardsResult,
    personasResult,
    unreadFeedbackResult,
    recentSignupsResult,
  ] = await Promise.all([
    // 総ユーザー数
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    // 今月の新規登録
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    // 先月の新規登録
    admin.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfLastMonth).lt('created_at', startOfMonth),
    // プラン分布
    admin.from('user_subscriptions').select('plan').eq('status', 'active'),
    // 総セッション数
    admin.from('customer_sessions').select('*', { count: 'exact', head: true }),
    // 今月のセッション数
    admin.from('customer_sessions').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    // 過去30日のセッション日別
    admin.from('customer_sessions').select('created_at').gte('created_at', new Date(Date.now() - 30 * 86400 * 1000).toISOString()),
    // アクティブユーザー（30日以内にセッションあり）
    admin.from('customer_sessions').select('persona_id').gte('created_at', new Date(Date.now() - 30 * 86400 * 1000).toISOString()),
    // トークン統計
    admin.from('user_credits').select('balance, sub_balance, total_used, total_purchased'),
    // アクティブ名刺数
    admin.from('business_cards').select('*', { count: 'exact', head: true }).eq('is_active', true),
    // アクティブペルソナ数
    admin.from('personas').select('*', { count: 'exact', head: true }).eq('is_active', true),
    // 未読フィードバック
    admin.from('feedback').select('*', { count: 'exact', head: true }).eq('is_read', false),
    // 最近の登録者（直近10名）
    admin.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  // MRR計算
  const planCounts: Record<string, number> = { free: 0, solo: 0, growth: 0, scale: 0 }
  for (const row of planDistResult.data ?? []) {
    planCounts[row.plan] = (planCounts[row.plan] ?? 0) + 1
  }
  const mrr = (planCounts.solo ?? 0) * PLANS.solo.priceJpy
             + (planCounts.growth ?? 0) * PLANS.growth.priceJpy
             + (planCounts.scale ?? 0) * PLANS.scale.priceJpy

  // 日別セッション集計
  const dailyMap: Record<string, number> = {}
  for (const row of sessionsDailyResult.data ?? []) {
    const day = row.created_at.slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + 1
  }
  const dailyLast30 = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }))

  // アクティブユーザー（ペルソナのuser_idを引く）
  const personaIds = [...new Set((activeUsersResult.data ?? []).map(r => r.persona_id))]
  let activeUserCount = 0
  if (personaIds.length > 0) {
    const { count } = await admin.from('personas')
      .select('user_id', { count: 'exact', head: false })
      .in('id', personaIds.slice(0, 500))
    activeUserCount = count ?? personaIds.length
  }

  // トークン集計
  const credits = tokenStatsResult.data ?? []
  const totalConsumed   = credits.reduce((s, r) => s + (r.total_used ?? 0), 0)
  const totalPurchased  = credits.reduce((s, r) => s + (r.total_purchased ?? 0), 0)
  const totalSubBalance = credits.reduce((s, r) => s + (r.sub_balance ?? 0), 0)
  const totalPaidBalance = credits.reduce((s, r) => s + (r.balance ?? 0), 0)

  const newThis = newThisMonthResult.count ?? 0
  const newLast = newLastMonthResult.count ?? 1  // ÷0回避

  return NextResponse.json({
    users: {
      total:         totalUsersResult.count ?? 0,
      newThisMonth:  newThis,
      newLastMonth:  newLastMonthResult.count ?? 0,
      momGrowthPct:  Math.round((newThis - newLast) / newLast * 100),
    },
    subscriptions: {
      byPlan:       planCounts,
      totalPaying:  (planCounts.solo ?? 0) + (planCounts.growth ?? 0) + (planCounts.scale ?? 0),
      mrr,
    },
    sessions: {
      total:      sessionsAllResult.count ?? 0,
      thisMonth:  sessionsThisMonthResult.count ?? 0,
      dailyLast30,
    },
    activeUsers30d: activeUserCount,
    tokens: {
      totalConsumed,
      totalPurchased,
      totalSubBalance,
      totalPaidBalance,
    },
    cards:    cardsResult.count ?? 0,
    personas: personasResult.count ?? 0,
    unreadFeedback: unreadFeedbackResult.count ?? 0,
    recentSignups: recentSignupsResult.data ?? [],
  })
}
