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

  // サブスクリプション情報を取得
  const { data: sub } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // トークン残高を取得
  const { data: credits } = await admin
    .from('user_credits')
    .select('balance, sub_balance, total_used')
    .eq('user_id', user.id)
    .maybeSingle()

  // 名刺・ペルソナ数を取得
  const [{ count: cardCount }, { count: personaCount }] = await Promise.all([
    admin.from('business_cards').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_active', true),
    admin.from('personas').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_active', true),
  ])

  const planId = (sub?.plan ?? 'free') as PlanId
  const plan   = PLANS[planId]

  return NextResponse.json({
    plan:               planId,
    planName:           plan.name,
    status:             sub?.status ?? 'active',
    cancelAtPeriodEnd:  sub?.cancel_at_period_end ?? false,
    currentPeriodEnd:   sub?.current_period_end ?? null,
    // トークン
    subBalance:         credits?.sub_balance    ?? 0,
    purchasedBalance:   credits?.balance        ?? 0,
    totalBalance:       (credits?.sub_balance ?? 0) + (credits?.balance ?? 0),
    totalUsed:          credits?.total_used     ?? 0,
    // 使用量
    cardCount:          cardCount  ?? 0,
    personaCount:       personaCount ?? 0,
    // プラン制限
    maxCards:           plan.maxCards,
    maxPersonas:        plan.maxPersonas,
    monthlyTokens:      plan.monthlyTokens,
    features:           plan.features,
  })
}
