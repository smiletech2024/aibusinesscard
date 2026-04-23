import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAdmin() {
  // 環境変数未設定の場合は全拒否（空文字列バイパス防止）
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return null

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  if (user.email !== adminEmail) return null
  return user
}

// フィードバック一覧取得
export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = getAdmin()
  const { data, error } = await admin
    .from('feedback')
    .select('id, category, body, is_read, admin_note, created_at, user_id, profiles(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    logger.error('admin:feedback:get', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

// 既読・メモ更新
export async function PATCH(req: NextRequest) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, is_read, admin_note } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = getAdmin()
  const updates: Record<string, unknown> = {}
  if (is_read !== undefined) updates.is_read = is_read
  if (admin_note !== undefined) updates.admin_note = admin_note

  const { error } = await admin.from('feedback').update(updates).eq('id', id)
  if (error) {
    logger.error('admin:feedback:patch', error, { id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logger.info('admin:feedback:updated', { id, by: user.email })
  return NextResponse.json({ ok: true })
}
