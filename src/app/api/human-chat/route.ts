import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, senderRole, content } = await req.json()

    // 入力バリデーション
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }
    if (!senderRole || !['owner', 'customer'].includes(senderRole)) {
      return NextResponse.json({ error: 'Invalid senderRole' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'content too long (max 5000 chars)' }, { status: 400 })
    }

    const admin = getAdmin()

    // オーナーロールの場合は認証必須
    if (senderRole === 'owner') {
      const supabase = await createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      // セッションがこのオーナーのものか確認
      const { data: session } = await admin
        .from('customer_sessions')
        .select('persona_id, personas!inner(user_id)')
        .eq('id', sessionId)
        .maybeSingle()

      const personaOwner = (session?.personas as { user_id?: string } | null)?.user_id
      if (!session || personaOwner !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // 顧客ロール：セッションの実在確認のみ
      const { data: session } = await admin
        .from('customer_sessions')
        .select('id, expires_at')
        .eq('id', sessionId)
        .maybeSingle()

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Session expired' }, { status: 410 })
      }
    }

    const { data: chat, error } = await admin
      .from('human_chats')
      .insert({
        session_id:  sessionId,
        sender_role: senderRole,
        content:     content.trim(),
      })
      .select()
      .single()

    if (error) {
      logger.error('human-chat:insert_failed', error, { session_id: sessionId })
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    // owner_chat ステータスに更新
    await admin
      .from('customer_sessions')
      .update({ status: 'owner_chat' })
      .eq('id', sessionId)

    return NextResponse.json({ chat })
  } catch (error) {
    logger.error('human-chat:unhandled', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

    const admin = getAdmin()

    // セッション実在確認
    const { data: session } = await admin
      .from('customer_sessions')
      .select('id, expires_at')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: chats, error } = await admin
      .from('human_chats')
      .select('id, sender_role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('human-chat:fetch_failed', error, { session_id: sessionId })
      return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
    }

    return NextResponse.json({ chats })
  } catch (error) {
    logger.error('human-chat:get_unhandled', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
