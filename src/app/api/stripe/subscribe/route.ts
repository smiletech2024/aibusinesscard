import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getPriceIdByPlan, type PlanId } from '@/lib/plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json() as { planId: PlanId }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const priceId = getPriceIdByPlan(planId)
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 既存の Stripe カスタマー ID を取得（あれば再利用）
    const { data: sub } = await admin
      .from('user_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // すでに同じプランのサブスクがあればポータルへ誘導
    if (sub?.stripe_subscription_id) {
      return NextResponse.json({ redirect: 'portal' })
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode:    'subscription',
      locale:  'ja',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        plan_id: planId,
      },
      subscription_data: {
        metadata: { user_id: user.id, plan_id: planId },
      },
      success_url: `${origin}/pricing?success=1&plan=${planId}`,
      cancel_url:  `${origin}/pricing?cancel=1`,
      customer_email: sub?.stripe_customer_id ? undefined : user.email,
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : {}),
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe subscribe error:', err)
    return NextResponse.json({ error: 'Subscription creation failed' }, { status: 500 })
  }
}
