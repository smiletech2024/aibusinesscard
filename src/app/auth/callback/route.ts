import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NEW_USER_BONUS_TOKENS } from '@/lib/credits'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 新規登録判定: created_at と last_sign_in_at が一致する場合は初回ログイン
      const isNewUser = data.user?.created_at === data.user?.last_sign_in_at

      if (isNewUser && data.user) {
        // ── 新規ユーザーにボーナストークンを付与 ──────────────────
        const admin = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // user_credits レコードを作成（まだ存在しない場合のみ）
        const { data: existing } = await admin
          .from('user_credits')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle()

        if (!existing) {
          await admin.from('user_credits').insert({
            user_id:         data.user.id,
            balance:         NEW_USER_BONUS_TOKENS,
            total_purchased: 0,
            total_used:      0,
          })

          await admin.from('credit_transactions').insert({
            user_id:     data.user.id,
            amount:      NEW_USER_BONUS_TOKENS,
            type:        'bonus',
            description: `新規登録ボーナス (${(NEW_USER_BONUS_TOKENS / 10_000).toFixed(0)}万トークン)`,
          })

          console.log(`🎁 New user bonus granted: ${data.user.id} +${NEW_USER_BONUS_TOKENS} tokens`)
        }
      }

      const redirectTo = isNewUser ? '/auth/confirmed' : next
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`)
}
