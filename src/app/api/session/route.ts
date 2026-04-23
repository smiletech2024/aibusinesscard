import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLANS, canStartSession, type PlanId } from '@/lib/plans'
import { logger } from '@/lib/logger'
import webpush from 'web-push'

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EXPIRES_HOURS = 24  // セッション有効期限

export async function POST(req: NextRequest) {
  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await req.json()
    const { personaId, cardId, customerName, customerEmail } = body

    // ── 入力バリデーション ──────────────────────────────────────
    if (!personaId || !UUID_RE.test(personaId)) {
      return NextResponse.json({ error: 'Invalid personaId' }, { status: 400 })
    }
    if (cardId && !UUID_RE.test(cardId)) {
      return NextResponse.json({ error: 'Invalid cardId' }, { status: 400 })
    }
    if (customerName && (typeof customerName !== 'string' || customerName.length > 100)) {
      return NextResponse.json({ error: 'customerName too long (max 100)' }, { status: 400 })
    }
    if (customerEmail && (typeof customerEmail !== 'string' || customerEmail.length > 200 || !EMAIL_RE.test(customerEmail))) {
      return NextResponse.json({ error: 'Invalid customerEmail' }, { status: 400 })
    }

    // ── レートリミット（同一personaへの乱用防止）──────────────
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentSessions } = await admin
      .from('customer_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
      .gte('created_at', oneMinuteAgo)

    if ((recentSessions ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'RATE_LIMIT', message: 'アクセスが集中しています。しばらくしてから再度お試しください。' },
        { status: 429 }
      )
    }

    // ── オーナーのプランを取得してセッション上限チェック ──────
    const { data: persona } = await admin
      .from('personas')
      .select('user_id')
      .eq('id', personaId)
      .maybeSingle()

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    if (persona.user_id) {
      const { data: sub } = await admin
        .from('user_subscriptions')
        .select('plan')
        .eq('user_id', persona.user_id)
        .maybeSingle()

      const planId = (sub?.plan ?? 'free') as PlanId
      const plan   = PLANS[planId]

      if (plan.maxSessionsPerMonth !== -1) {
        // ユーザー全ペルソナ横断で集計（ペルソナ単位では上限回避できてしまうため）
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { data: userPersonas } = await admin
          .from('personas')
          .select('id')
          .eq('user_id', persona.user_id)

        const allPersonaIds = userPersonas?.map(p => p.id) ?? [personaId]

        const { count } = await admin
          .from('customer_sessions')
          .select('*', { count: 'exact', head: true })
          .in('persona_id', allPersonaIds)
          .gte('created_at', startOfMonth.toISOString())

        if (!canStartSession(planId, count ?? 0)) {
          return NextResponse.json(
            {
              error:        'SESSION_LIMIT_EXCEEDED',
              message:      `今月のAI対話数が上限（${plan.maxSessionsPerMonth}件）に達しました。`,
              limitReached: true,
              plan:         planId,
            },
            { status: 403 }
          )
        }
      }
    }

    // セッション有効期限（24時間後）
    const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000).toISOString()

    const { data: session, error } = await admin
      .from('customer_sessions')
      .insert({
        persona_id:     personaId,
        card_id:        cardId || null,
        customer_name:  customerName?.trim() || null,
        customer_email: customerEmail?.trim().toLowerCase() || null,
        status:         'ai_chat',
        expires_at:     expiresAt,
      })
      .select()
      .single()

    if (error) {
      logger.error('session:insert_failed', error, { persona_id: personaId })
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    logger.info('session:created', { session_id: session.id, persona_id: personaId })

    // ── オーナーへプッシュ通知（fire-and-forget）────────────────
    if (persona.user_id) {
      ;(async () => {
        try {
          const { data: ownerSubs } = await admin
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', persona.user_id)
            .eq('role', 'owner')

          if (ownerSubs?.length) {
            webpush.setVapidDetails(
              process.env.VAPID_SUBJECT!,
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
              process.env.VAPID_PRIVATE_KEY!
            )
            const payload = JSON.stringify({
              title: '🔔 新しい相談が来ました',
              body:  `${customerName?.trim() || 'お客様'}があなたのAI名刺に話しかけています`,
              url:   '/dashboard',
            })
            await Promise.allSettled(
              ownerSubs.map(({ subscription }) =>
                webpush.sendNotification(subscription as webpush.PushSubscription, payload)
              )
            )
          }
        } catch (pushErr) {
          logger.error('session:push_notify_failed', pushErr, { persona_id: personaId })
        }
      })()
    }

    return NextResponse.json({ session })
  } catch (error) {
    logger.error('session:unhandled', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
