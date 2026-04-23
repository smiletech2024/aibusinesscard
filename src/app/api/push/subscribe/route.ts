import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { sessionId, userId, role, subscription } = await req.json()

    if (!subscription || typeof subscription !== 'object') {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    let error

    if (userId && !sessionId) {
      // ── オーナー向けプッシュ購読 — 認証済みユーザー自身のみ ──────
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
      // 自分以外の userId への登録を禁止（乗っ取り防止）
      if (user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      await supabase.from('push_subscriptions').delete().match({ user_id: userId, role: 'owner' })
      const { error: e } = await supabase
        .from('push_subscriptions')
        .insert({ user_id: userId, role: 'owner', subscription })
      error = e
    } else {
      // ── セッションレベル購読（顧客側） ──────────────────────────
      if (!sessionId || !UUID_RE.test(sessionId)) {
        return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
      }
      const VALID_ROLES = ['customer', 'agent']
      if (!role || !VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const { error: e } = await supabase
        .from('push_subscriptions')
        .upsert(
          { session_id: sessionId, role, subscription },
          { onConflict: 'session_id,role' }
        )
      error = e
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('push subscribe error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
