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
    return NextResponse.json({ messages: [] })
  }

  const admin = getAdmin()
  let query = admin
    .from('support_messages')
    .select('id, role, content, created_at')
    .eq('session_key', sessionKey)
    .eq('role', 'operator') // 運営メッセージのみ
    .order('created_at', { ascending: true })

  if (after) {
    query = query.gt('created_at', after)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ messages: [] })
  }

  return NextResponse.json({ messages: data ?? [] })
}
