import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLANS, canStartSession, type PlanId } from '@/lib/plans'

export async function POST(req: NextRequest) {
  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { personaId, cardId, customerName, customerEmail } = await req.json()

    // ── オーナーのプランを取得してセッション上限チェック ─────────
    const { data: persona } = await admin
      .from('personas')
      .select('user_id')
      .eq('id', personaId)
      .maybeSingle()

    if (persona?.user_id) {
      const { data: sub } = await admin
        .from('user_subscriptions')
        .select('plan')
        .eq('user_id', persona.user_id)
        .maybeSingle()

      const planId = (sub?.plan ?? 'free') as PlanId
      const plan   = PLANS[planId]

      if (plan.maxSessionsPerMonth !== -1) {
        // 今月のセッション数を取得
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count } = await admin
          .from('customer_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('persona_id', personaId)
          .gte('created_at', startOfMonth.toISOString())

        if (!canStartSession(planId, count ?? 0)) {
          return NextResponse.json(
            {
              error:         'SESSION_LIMIT_EXCEEDED',
              message:       `今月のAI対話数が上限（${plan.maxSessionsPerMonth}件）に達しました。`,
              limitReached:  true,
              plan:          planId,
            },
            { status: 403 }
          )
        }
      }
    }

    const { data: session, error } = await admin
      .from('customer_sessions')
      .insert({
        persona_id:     personaId,
        card_id:        cardId || null,
        customer_name:  customerName || null,
        customer_email: customerEmail || null,
        status:         'ai_chat',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Session create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
