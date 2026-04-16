import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

// GET /api/admin/support-sessions
// セッション一覧（最新メッセージ付き）
export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = getAdmin()

  // 最新50セッション
  const { data: sessions } = await admin
    .from('support_sessions')
    .select('session_key, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (!sessions?.length) return NextResponse.json({ sessions: [] })

  // 各セッションの全メッセージ取得
  const sessionKeys = sessions.map(s => s.session_key)
  const { data: messages } = await admin
    .from('support_messages')
    .select('session_key, role, content, created_at')
    .in('session_key', sessionKeys)
    .order('created_at', { ascending: true })

  // セッションごとにグループ化
  const msgMap: Record<string, typeof messages> = {}
  for (const m of messages ?? []) {
    if (!msgMap[m.session_key]) msgMap[m.session_key] = []
    msgMap[m.session_key]!.push(m)
  }

  const result = sessions.map(s => ({
    ...s,
    messages: msgMap[s.session_key] ?? [],
  }))

  return NextResponse.json({ sessions: result })
}

// POST /api/admin/support-sessions
// 運営が会話に割り込む
export async function POST(req: NextRequest) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { session_key, content } = await req.json()
  if (!session_key || !content?.trim()) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }

  const admin = getAdmin()

  const { data, error } = await admin
    .from('support_messages')
    .insert({ session_key, role: 'operator', content: content.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // セッション更新日時を更新
  await admin
    .from('support_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('session_key', session_key)

  return NextResponse.json({ message: data })
}
