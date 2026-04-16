import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { sessionKey } = await req.json()
    if (!sessionKey) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const admin = getAdmin()
    const now = new Date().toISOString()

    await admin
      .from('support_sessions')
      .upsert({ session_key: sessionKey, escalated: true, escalated_at: now, updated_at: now }, { onConflict: 'session_key' })

    // Add system message visible in admin
    await admin.from('support_messages').insert({
      session_key: sessionKey,
      role: 'operator',
      content: '🆘 ユーザーが人間のサポートを要請しました',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[escalate]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
