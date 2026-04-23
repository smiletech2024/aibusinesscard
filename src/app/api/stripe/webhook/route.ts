import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CREDIT_PACKAGES } from '@/lib/credits'
import { getPlanByPriceId, PLANS, type PlanId, getPriceIdByPlan } from '@/lib/plans'
import { logger } from '@/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export const runtime = 'nodejs'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── トークン残高操作 ──────────────────────────────────────────
async function upsertCredits(
  admin: ReturnType<typeof getAdmin>,
  userId: string,
  opts: { addBalance?: number; addSubBalance?: number; setSubBalance?: number; addTotalPurchased?: number; subResetAt?: string }
) {
  const { data: existing } = await admin
    .from('user_credits')
    .select('balance, sub_balance, total_purchased, total_used')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const updates: Record<string, unknown> = {}
    if (opts.addBalance        !== undefined) updates.balance         = existing.balance         + opts.addBalance
    if (opts.addSubBalance     !== undefined) updates.sub_balance     = existing.sub_balance     + opts.addSubBalance
    if (opts.setSubBalance     !== undefined) updates.sub_balance     = opts.setSubBalance
    if (opts.addTotalPurchased !== undefined) updates.total_purchased = existing.total_purchased + opts.addTotalPurchased
    if (opts.subResetAt        !== undefined) updates.sub_reset_at    = opts.subResetAt
    await admin.from('user_credits').update(updates).eq('user_id', userId)
  } else {
    await admin.from('user_credits').insert({
      user_id:         userId,
      balance:         opts.addBalance        ?? 0,
      sub_balance:     opts.setSubBalance     ?? opts.addSubBalance ?? 0,
      total_purchased: opts.addTotalPurchased ?? 0,
      total_used:      0,
      sub_reset_at:    opts.subResetAt ?? null,
    })
  }
}

// ─── Stripe イベント単位の冪等性チェック ──────────────────────
async function isEventProcessed(admin: ReturnType<typeof getAdmin>, eventId: string): Promise<boolean> {
  const { data } = await admin
    .from('credit_transactions')
    .select('id')
    .eq('stripe_event_id', eventId)
    .maybeSingle()
  return !!data
}

// ─── メインハンドラ ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    logger.error('webhook:signature_failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = getAdmin()

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ① checkout.session.completed
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.mode === 'payment') {
      const { user_id, package_id, tokens } = session.metadata ?? {}
      if (!user_id || !tokens) return NextResponse.json({ received: true })

      const tokensNum = parseInt(tokens, 10)
      if (isNaN(tokensNum) || tokensNum <= 0) return NextResponse.json({ received: true })

      const { data: dup } = await admin
        .from('credit_transactions')
        .select('id').eq('stripe_session_id', session.id).maybeSingle()
      if (dup) return NextResponse.json({ received: true, skipped: true })

      const pkg = CREDIT_PACKAGES.find(p => p.id === package_id)
      await admin.from('credit_transactions').insert({
        user_id,
        amount:            tokensNum,
        type:              'purchase',
        description:       `${pkg?.name ?? 'トークン'}パック購入 (${Math.floor(tokensNum / 10_000)}万トークン)`,
        stripe_session_id: session.id,
        stripe_event_id:   event.id,
      })
      await upsertCredits(admin, user_id, { addBalance: tokensNum, addTotalPurchased: tokensNum })
      logger.info('webhook:token_purchase', { user_id, tokens: tokensNum })
    }

    if (session.mode === 'subscription') {
      const { user_id, plan_id } = session.metadata ?? {}
      if (user_id && plan_id) {
        const planId = plan_id as PlanId
        const plan   = PLANS[planId]
        if (plan && plan.monthlyTokens > 0) {
          // イベント ID で冪等性を保証（checkout と subscription.created の二重発火を確実に防ぐ）
          if (await isEventProcessed(admin, event.id)) {
            return NextResponse.json({ received: true, skipped: true })
          }

          const stripeSubId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as { id?: string } | null)?.id

          if (stripeSubId) {
            await admin.from('user_subscriptions').upsert({
              user_id,
              plan:                   planId,
              stripe_customer_id:     typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string } | null)?.id,
              stripe_subscription_id: stripeSubId,
              stripe_price_id:        getPriceIdByPlan(planId) ?? '',
              status:                 'active',
              current_period_start:   new Date().toISOString(),
            }, { onConflict: 'user_id' })
          }

          await upsertCredits(admin, user_id, {
            setSubBalance: plan.monthlyTokens,
            subResetAt:    new Date().toISOString(),
          })
          await admin.from('credit_transactions').insert({
            user_id,
            amount:          plan.monthlyTokens,
            type:            'bonus',
            description:     `${plan.name}プラン 月次トークン付与（初回checkout）`,
            stripe_event_id: event.id,
          })
          logger.info('webhook:sub_checkout_grant', { user_id, plan: planId, tokens: plan.monthlyTokens })
        }
      }
    }

    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ② customer.subscription.created / updated
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub     = event.data.object as Stripe.Subscription
    const userId  = sub.metadata?.user_id
    const priceId = sub.items.data[0]?.price?.id
    if (!userId || !priceId) return NextResponse.json({ received: true })

    // イベント ID ベースの冪等性（checkout と二重発火対策）
    if (await isEventProcessed(admin, event.id)) {
      return NextResponse.json({ received: true, skipped: true })
    }

    const planId      = getPlanByPriceId(priceId) ?? (sub.metadata?.plan_id as PlanId | undefined) ?? 'free'
    const plan        = PLANS[planId]
    const periodStart = new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000).toISOString()
    const periodEnd   = new Date((sub as unknown as { current_period_end:   number }).current_period_end   * 1000).toISOString()

    await admin.from('user_subscriptions').upsert({
      user_id:                userId,
      plan:                   planId,
      stripe_customer_id:     typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id:        priceId,
      status:                 sub.status,
      current_period_start:   periodStart,
      current_period_end:     periodEnd,
      cancel_at_period_end:   sub.cancel_at_period_end,
    }, { onConflict: 'user_id' })

    if (plan.monthlyTokens > 0) {
      await upsertCredits(admin, userId, { setSubBalance: plan.monthlyTokens, subResetAt: periodStart })
      await admin.from('credit_transactions').insert({
        user_id:         userId,
        amount:          plan.monthlyTokens,
        type:            'bonus',
        description:     `${plan.name}プラン 月次トークン付与 (${Math.floor(plan.monthlyTokens / 10_000)}万トークン)`,
        stripe_event_id: event.id,
      })
    }

    logger.info('webhook:sub_updated', { user_id: userId, plan: planId, event: event.type })
    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ③ invoice.paid — 毎月の自動更新でトークンリセット
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice
    if ((invoice as unknown as { billing_reason: string }).billing_reason !== 'subscription_cycle') {
      return NextResponse.json({ received: true })
    }

    if (await isEventProcessed(admin, event.id)) {
      return NextResponse.json({ received: true, skipped: true })
    }

    const inv   = invoice as unknown as { subscription?: string | { id: string } }
    const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id
    if (!subId) return NextResponse.json({ received: true })

    const { data: subRow } = await admin
      .from('user_subscriptions')
      .select('user_id, plan')
      .eq('stripe_subscription_id', subId)
      .maybeSingle()
    if (!subRow) return NextResponse.json({ received: true })

    const plan = PLANS[subRow.plan as PlanId]
    if (!plan || plan.monthlyTokens <= 0) return NextResponse.json({ received: true })

    await upsertCredits(admin, subRow.user_id, {
      setSubBalance: plan.monthlyTokens,
      subResetAt:    new Date().toISOString(),
    })
    await admin.from('credit_transactions').insert({
      user_id:         subRow.user_id,
      amount:          plan.monthlyTokens,
      type:            'bonus',
      description:     `${plan.name}プラン 月次トークン更新 (${Math.floor(plan.monthlyTokens / 10_000)}万トークン)`,
      stripe_event_id: event.id,
    })

    logger.info('webhook:monthly_reset', { user_id: subRow.user_id, plan: subRow.plan })
    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ④ customer.subscription.deleted — フリープランに戻す
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id
    if (!userId) return NextResponse.json({ received: true })

    await admin.from('user_subscriptions').update({
      plan:               'free',
      status:             'canceled',
      stripe_price_id:    null,
      current_period_end: null,
    }).eq('user_id', userId)

    await upsertCredits(admin, userId, { setSubBalance: 0 })
    logger.info('webhook:sub_canceled', { user_id: userId })
    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑤ charge.dispute.created — チャージバック申請を検知
  //    トークン凍結記録 + 管理者へ即時通知
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as Stripe.Dispute

    let stripeCustomerId: string | undefined
    try {
      const charge     = await stripe.charges.retrieve(dispute.charge as string)
      stripeCustomerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
    } catch (e) {
      logger.error('webhook:dispute_charge_fetch', e, { dispute_id: dispute.id })
    }

    if (stripeCustomerId) {
      const { data: subRow } = await admin
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .maybeSingle()

      if (subRow) {
        const disputedYen = Math.floor(dispute.amount / 100)
        // 手動確認用の記録（自動控除は行わず管理者判断に委ねる）
        await admin.from('credit_transactions').insert({
          user_id:         subRow.user_id,
          amount:          0,
          type:            'dispute',
          description:     `⚠️ チャージバック申請 dispute_id=${dispute.id} ¥${disputedYen}`,
          stripe_event_id: event.id,
        })
        logger.warn('webhook:dispute_received', {
          user_id:    subRow.user_id,
          dispute_id: dispute.id,
          amount_yen: disputedYen,
        })
      }
    }

    // 管理者へ fire-and-forget 通知
    const adminEmail = process.env.ADMIN_EMAIL
    const resendKey  = process.env.RESEND_API_KEY
    if (adminEmail && resendKey) {
      fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from:    'AI名刺 <noreply@aimeishi.biz>',
          to:      adminEmail,
          subject: `⚠️ チャージバック申請が来ました — ${dispute.id}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#DC2626">⚠️ チャージバック申請</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">dispute_id</td><td style="padding:8px;border-bottom:1px solid #eee">${dispute.id}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">charge_id</td><td style="padding:8px;border-bottom:1px solid #eee">${dispute.charge}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">金額</td><td style="padding:8px;border-bottom:1px solid #eee">¥${Math.floor(dispute.amount / 100)}</td></tr>
                <tr><td style="padding:8px;color:#666">理由</td><td style="padding:8px">${dispute.reason}</td></tr>
              </table>
              <p style="margin-top:20px"><a href="https://dashboard.stripe.com/disputes/${dispute.id}" style="background:#F26722;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Stripe Dashboard で確認 →</a></p>
            </div>
          `,
        }),
      }).catch(e => logger.error('webhook:dispute_email_failed', e))
    }

    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
