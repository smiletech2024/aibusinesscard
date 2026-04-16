import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/support-chat/poll?session=XXX&after=ISO_DATE
// 運営からの割り込みメッセージを返す
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionKey = searchParams.get('session')
  const after = searchParams.get('after')

  if (!sessionKey) {
    return NextResponse.json({ messages: [], operatorActive: false })
  }

  const admin = getAdmin()

  // セッションの operator_active 状態を取得
  const { data: session } = await admin
    .from('support_sessions')
    .select('operator_active')
    .eq('session_key', sessionKey)
    .maybeSingle()

  let query = admin
    .from('support_messages')
    .select('id, role, content, created_at')
    .eq('session_key', sessionKey)
    .eq('role', 'operator')
    .order('created_at', { ascending: true })

  if (after) {
    query = query.gt('created_at', after)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ messages: [], operatorActive: session?.operator_active ?? false })
  }

  return NextResponse.json({ messages: data ?? [], operatorActive: session?.operator_active ?? false })
}
