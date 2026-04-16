import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_CATEGORIES = ['general', 'feature', 'bug'] as const

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, body } = await req.json()

  if (!body || body.trim().length < 1)
    return NextResponse.json({ error: '内容を入力してください' }, { status: 400 })
  if (body.trim().length > 2000)
    return NextResponse.json({ error: '2000文字以内で入力してください' }, { status: 400 })
  if (!ALLOWED_CATEGORIES.includes(category))
    return NextResponse.json({ error: 'カテゴリが不正です' }, { status: 400 })

  const admin = getAdmin()
  const { error } = await admin.from('feedback').insert({
    user_id:  user.id,
    category,
    body:     body.trim(),
    is_read:  false,
  })

  if (error) {
    console.error('Feedback insert error:', error)
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
