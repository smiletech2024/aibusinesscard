import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 新規登録からのメール認証 → 完了ページへ
      // ログイン済みセッションからのリンク → next先へ
      const isNewUser = data.user?.created_at === data.user?.last_sign_in_at
      const redirectTo = isNewUser ? '/auth/confirmed' : next
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
