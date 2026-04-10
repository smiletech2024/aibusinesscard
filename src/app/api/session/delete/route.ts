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

    // サービスロールで確認・削除（RLSをバイパス）
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // オーナー確認（persona_id → personas.user_id = user.id）
    const { data: session } = await admin
      .from('customer_sessions').select('persona_id').eq('id', sessionId).single()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: persona } = await admin
      .from('personas').select('user_id').eq('id', session.persona_id).single()
    if (!persona || persona.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
