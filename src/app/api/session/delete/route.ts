import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    // ログイン確認
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('[delete] SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'Server misconfiguration: service key missing' }, { status: 500 })
    }

    // サービスロールで確認・削除（RLSをバイパス）
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    )

    // オーナー確認（persona_id → personas.user_id = user.id）
    const { data: session, error: sessionErr } = await admin
      .from('customer_sessions').select('persona_id').eq('id', sessionId).single()
    console.log('[delete] session:', session, 'err:', sessionErr)
    if (!session) return NextResponse.json({ error: 'Not found', detail: String(sessionErr) }, { status: 404 })
    const { data: persona, error: personaErr } = await admin
      .from('personas').select('user_id').eq('id', session.persona_id).single()
    console.log('[delete] persona:', persona, 'err:', personaErr, 'userId:', user.id)
    if (!persona || persona.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', personaUserId: persona?.user_id, userId: user.id }, { status: 403 })
    }
    await admin.from('human_chats').delete().eq('session_id', sessionId)
    await admin.from('conversation_summaries').delete().eq('session_id', sessionId)
    await admin.from('ai_conversations').delete().eq('session_id', sessionId)
    await admin.from('customer_sessions').delete().eq('id', sessionId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
