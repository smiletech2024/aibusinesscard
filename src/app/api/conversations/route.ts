import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/conversations?sessionId=xxx
 *
 * セキュリティモデル：
 * - sessionId (UUID) がケイパビリティトークンとして機能する
 * - UUID は現実的に推測不可能（128bit エントロピー）
 * - セッションの実在・有効期限を必ず検証してから返却
 * - 必要最低限のカラムのみ返す（select * を廃止）
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  // UUID 形式チェック（ブルートフォース・インジェクション対策）
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // セッションの実在確認（存在しない / 有効期限切れは拒否）
  const { data: session } = await admin
    .from('customer_sessions')
    .select('id, expires_at')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    logger.warn('conversations:session_expired', { session_id: sessionId })
    return NextResponse.json({ error: 'Session expired' }, { status: 410 })
  }

  const { data, error } = await admin
    .from('ai_conversations')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('conversations:fetch_failed', error, { session_id: sessionId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversations: data ?? [] })
}
