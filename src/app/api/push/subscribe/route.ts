import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { sessionId, userId, role, subscription } = await req.json()

    let error
    if (userId && !sessionId) {
      // ユーザーレベル購読（オーナー向け新規セッション通知）
      await supabase.from('push_subscriptions').delete().match({ user_id: userId, role: 'owner' })
      const { error: e } = await supabase
        .from('push_subscriptions')
        .insert({ user_id: userId, role: 'owner', subscription })
      error = e
    } else {
      // セッションレベル購読（既存の動作）
      const { error: e } = await supabase
        .from('push_subscriptions')
        .upsert(
          { session_id: sessionId, role, subscription },
          { onConflict: 'session_id,role' }
        )
      error = e
    }

    if (error) {
      console.error('push subscribe error:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
