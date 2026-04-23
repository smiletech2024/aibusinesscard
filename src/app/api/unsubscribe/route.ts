import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }

    // ── ユーザー本人の認証を確認（IDOR防止） ────────────────────────
    // GETパラメータ経由でuserIdが漏洩しうるため、必ずauthで検証
    const { createClient: createAuthClient } = await import('@/lib/supabase/server')
    const supabase = await createAuthClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      // 未認証または他ユーザーの配信停止は静かに成功を返す（enumeration防止）
      return NextResponse.json({ ok: true })
    }

    const admin = getAdmin()

    // Supabase auth user_metadata に配信停止フラグを保存
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { email_unsubscribed: true },
    })

    if (error) {
      console.error('[unsubscribe]', error)
      return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[unsubscribe]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
