import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { CREDIT_PACKAGES } from '@/lib/credits'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const { packageId } = await req.json()

    // 認証確認
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // パッケージ検証
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Stripe Checkoutセッション作成
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'ja',
      currency: 'jpy',
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            unit_amount: pkg.priceJpy,
            product_data: {
              name: `AI名刺 ${pkg.name}パック`,
              description: `${(pkg.tokens / 10_000).toFixed(0)}万トークン付与${pkg.bonusLabel ? ` (${pkg.bonusLabel})` : ''}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id:   user.id,
        package_id: pkg.id,
        tokens:    String(pkg.tokens),
      },
      success_url: `${origin}/credits?success=1&package=${pkg.name}`,
      cancel_url:  `${origin}/credits?cancel=1`,
      customer_email: user.email,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Checkout session creation failed' }, { status: 500 })
  }
}
