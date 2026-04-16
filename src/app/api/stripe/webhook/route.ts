import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CREDIT_PACKAGES } from '@/lib/credits'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

// Next.js 13+ App Router では body を生のバッファで読む
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const { user_id, package_id, tokens } = session.metadata ?? {}

  if (!user_id || !tokens) {
    console.error('Missing metadata in Stripe session:', session.id)
    return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
  }

  const tokensNum = parseInt(tokens, 10)
  if (isNaN(tokensNum) || tokensNum <= 0) {
    return NextResponse.json({ error: 'Invalid tokens value' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 重複処理防止: stripe_session_id がすでに記録されていればスキップ
  const { data: existing } = await admin
    .from('credit_transactions')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true, skipped: true })
  }

  const pkg = CREDIT_PACKAGES.find(p => p.id === package_id)
  const description = pkg
    ? `${pkg.name}パック購入 (${(tokensNum / 10_000).toFixed(0)}万トークン)`
    : `トークン購入 (${(tokensNum / 10_000).toFixed(0)}万トークン)`

  // トランザクションを記録
  await admin.from('credit_transactions').insert({
    user_id,
    amount:            tokensNum,
    type:              'purchase',
    description,
    stripe_session_id: session.id,
  })

  // user_credits を upsert して残高を加算
  const { data: existing_credits } = await admin
    .from('user_credits')
    .select('balance, total_purchased')
    .eq('user_id', user_id)
    .maybeSingle()

  if (existing_credits) {
    await admin
      .from('user_credits')
      .update({
        balance:          existing_credits.balance + tokensNum,
        total_purchased:  existing_credits.total_purchased + tokensNum,
      })
      .eq('user_id', user_id)
  } else {
    await admin.from('user_credits').insert({
      user_id,
      balance:          tokensNum,
      total_purchased:  tokensNum,
      total_used:       0,
    })
  }

  console.log(`✅ Credits added: user=${user_id} +${tokensNum} tokens (session=${session.id})`)
  return NextResponse.json({ received: true })
}
