import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLANS, type PlanId } from '@/lib/plans'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [subResult, creditsResult, cardResult, personaResult] = await Promise.all([
    admin.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('user_credits').select('balance, sub_balance, total_used').eq('user_id', user.id).maybeSingle(),
    admin.from('business_cards').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    admin.from('personas').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
  ])

  // 今月のセッション数（ペルソナ経由でカウント）
  const { data: personaIds } = await admin
    .from('personas')
    .select('id')
    .eq('user_id', user.id)

  let monthlySessionCount = 0
  if (personaIds && personaIds.length > 0) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await admin
      .from('customer_sessions')
      .select('*', { count: 'exact', head: true })
      .in('persona_id', personaIds.map(p => p.id))
      .gte('created_at', startOfMonth.toISOString())

    monthlySessionCount = count ?? 0
  }

  const planId = (subResult.data?.plan ?? 'free') as PlanId
  const plan   = PLANS[planId]

  return NextResponse.json({
    plan:               planId,
    planName:           plan.name,
    status:             subResult.data?.status ?? 'active',
    cancelAtPeriodEnd:  subResult.data?.cancel_at_period_end ?? false,
    currentPeriodEnd:   subResult.data?.current_period_end ?? null,
    // トークン
    subBalance:         creditsResult.data?.sub_balance    ?? 0,
    purchasedBalance:   creditsResult.data?.balance        ?? 0,
    totalBalance:       (creditsResult.data?.sub_balance ?? 0) + (creditsResult.data?.balance ?? 0),
    totalUsed:          creditsResult.data?.total_used     ?? 0,
    // 使用量
    cardCount:          cardResult.count  ?? 0,
    personaCount:       personaResult.count ?? 0,
    monthlySessionCount,
    // プラン制限
    maxCards:           plan.maxCards,
    maxPersonas:        plan.maxPersonas,
    maxSessionsPerMonth: plan.maxSessionsPerMonth,
    monthlyTokens:      plan.monthlyTokens,
    showBranding:       plan.showBranding,
    analysisHistoryLimit: plan.analysisHistoryLimit,
    features:           plan.features,
  })
}
