import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CREDIT_PACKAGES } from '@/lib/credits'
import { getPlanByPriceId, PLANS, type PlanId } from '@/lib/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export const runtime = 'nodejs'

// ─── 管理クライアント ──────────────────────────────────────────
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
    if (opts.addBalance      !== undefined) updates.balance          = existing.balance          + opts.addBalance
    if (opts.addSubBalance   !== undefined) updates.sub_balance      = existing.sub_balance      + opts.addSubBalance
    if (opts.setSubBalance   !== undefined) updates.sub_balance      = opts.setSubBalance
    if (opts.addTotalPurchased !== undefined) updates.total_purchased = existing.total_purchased + opts.addTotalPurchased
    if (opts.subResetAt      !== undefined) updates.sub_reset_at     = opts.subResetAt
    await admin.from('user_credits').update(updates).eq('user_id', userId)
  } else {
    await admin.from('user_credits').insert({
      user_id:         userId,
      balance:         opts.addBalance        ?? 0,
      sub_balance:     opts.setSubBalance      ?? opts.addSubBalance ?? 0,
      total_purchased: opts.addTotalPurchased  ?? 0,
      total_used:      0,
      sub_reset_at:    opts.subResetAt ?? null,
    })
  }
}

// ─── メインハンドラ ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = getAdmin()

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ① checkout.session.completed
  //    ・mode=payment  → 都度課金（トークンパック）
  //    ・mode=subscription → サブスク開始（以降 subscription イベントに委譲）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.mode === 'payment') {
      // ── 都度課金：トークンパック購入 ──
      const { user_id, package_id, tokens } = session.metadata ?? {}
      if (!user_id || !tokens) return NextResponse.json({ received: true })

      const tokensNum = parseInt(tokens, 10)
      if (isNaN(tokensNum) || tokensNum <= 0) return NextResponse.json({ received: true })

      // 重複防止
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
      })
      await upsertCredits(admin, user_id, {
        addBalance:        tokensNum,
        addTotalPurchased: tokensNum,
      })
      console.log(`✅ Token purchase: user=${user_id} +${tokensNum}`)
    }

    // subscription mode → customer.subscription.created が後続で来るので何もしない
    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ② customer.subscription.created / updated
  //    サブスク作成・変更時にプランと月次トークンを設定
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub      = event.data.object as Stripe.Subscription
    const userId   = sub.metadata?.user_id
    const priceId  = sub.items.data[0]?.price?.id
    if (!userId || !priceId) return NextResponse.json({ received: true })

    const planId   = getPlanByPriceId(priceId) ?? 'free'
    const plan     = PLANS[planId]
    const periodStart = new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000).toISOString()
    const periodEnd   = new Date((sub as unknown as { current_period_end: number }).current_period_end   * 1000).toISOString()

    // user_subscriptions を upsert
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

    // 月次トークンをセット（新規 or 変更時に現在の割当量にリセット）
    if (plan.monthlyTokens > 0) {
      await upsertCredits(admin, userId, {
        setSubBalance: plan.monthlyTokens,
        subResetAt:    periodStart,
      })
      await admin.from('credit_transactions').insert({
        user_id:     userId,
        amount:      plan.monthlyTokens,
        type:        'bonus',
        description: `${plan.name}プラン 月次トークン付与 (${Math.floor(plan.monthlyTokens / 10_000)}万トークン)`,
      })
    }

    console.log(`✅ Subscription ${event.type}: user=${userId} plan=${planId}`)
    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ③ invoice.paid
  //    毎月の自動更新 → 月次トークンをリセット
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice
    if ((invoice as unknown as { billing_reason: string }).billing_reason !== 'subscription_cycle') {
      return NextResponse.json({ received: true }) // 初回・手動請求はスキップ
    }

    const inv = invoice as unknown as { subscription?: string | { id: string } }
    const subId = typeof inv.subscription === 'string'
      ? inv.subscription
      : inv.subscription?.id
    if (!subId) return NextResponse.json({ received: true })

    const { data: subRow } = await admin
      .from('user_subscriptions')
      .select('user_id, plan')
      .eq('stripe_subscription_id', subId)
      .maybeSingle()
    if (!subRow) return NextResponse.json({ received: true })

    const plan = PLANS[subRow.plan as PlanId]
    if (!plan || plan.monthlyTokens <= 0) return NextResponse.json({ received: true })

    // 月次トークンをリセット（購入トークンは触らない）
    await upsertCredits(admin, subRow.user_id, {
      setSubBalance: plan.monthlyTokens,
      subResetAt:    new Date().toISOString(),
    })
    await admin.from('credit_transactions').insert({
      user_id:     subRow.user_id,
      amount:      plan.monthlyTokens,
      type:        'bonus',
      description: `${plan.name}プラン 月次トークン更新 (${Math.floor(plan.monthlyTokens / 10_000)}万トークン)`,
    })

    console.log(`🔄 Monthly token reset: user=${subRow.user_id} plan=${subRow.plan}`)
    return NextResponse.json({ received: true })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ④ customer.subscription.deleted
  //    サブスクキャンセル → free プランに戻す・月次トークンをクリア
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id
    if (!userId) return NextResponse.json({ received: true })

    await admin.from('user_subscriptions').update({
      plan:                   'free',
      status:                 'canceled',
      stripe_subscription_id: null,
      stripe_price_id:        null,
      current_period_end:     null,
    }).eq('user_id', userId)

    // 月次トークンを0にリセット（購入トークンはそのまま）
    await upsertCredits(admin, userId, { setSubBalance: 0 })

    console.log(`❌ Subscription canceled: user=${userId} → free`)
    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
