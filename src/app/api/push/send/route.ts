import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { sessionId, targetRole, title, body, url } = await req.json()

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('session_id', sessionId)
      .eq('role', targetRole)

    if (!subs?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const payload = JSON.stringify({ title, body, url })
    const results = await Promise.allSettled(
      subs.map(({ subscription }) =>
        webpush.sendNotification(subscription as webpush.PushSubscription, payload)
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (e) {
    console.error('push send error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
