import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { sessionId, role, subscription } = await req.json()

    // upsert: 同じsessionId+roleの購読を上書き
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { session_id: sessionId, role, subscription },
        { onConflict: 'session_id,role' }
      )

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
