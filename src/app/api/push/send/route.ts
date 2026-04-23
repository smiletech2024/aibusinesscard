import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // 送信者は認証必須（なりすまし通知を防ぐ）
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sessionId, targetRole, title, body, url } = await req.json()

    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }
    const VALID_ROLES = ['customer', 'agent', 'owner']
    if (!targetRole || !VALID_ROLES.includes(targetRole)) {
      return NextResponse.json({ error: 'Invalid targetRole' }, { status: 400 })
    }
    if (!title || typeof title !== 'string' || title.length > 100) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
    }

    // セッションがこのユーザーのペルソナに紐づくか確認
    const { data: sessionRow } = await supabase
      .from('customer_sessions')
      .select('persona_id, personas!inner(user_id)')
      .eq('id', sessionId)
      .maybeSingle()

    type SessionRow = { persona_id: string; personas: { user_id: string } }
    const row = sessionRow as unknown as SessionRow | null
    if (!row || row.personas?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
