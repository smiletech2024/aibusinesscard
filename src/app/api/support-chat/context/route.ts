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
    const { sessionKey, customerName, meetingContext } = await req.json()
    if (!sessionKey) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const admin = getAdmin()
    await admin.from('support_sessions').upsert({
      session_key:      sessionKey,
      customer_name:    customerName || null,
      meeting_context:  meetingContext || null,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'session_key' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[context]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
