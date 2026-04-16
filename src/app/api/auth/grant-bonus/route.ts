import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NEW_USER_BONUS_TOKENS } from '@/lib/credits'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // すでにボーナス付与済みならスキップ
    const { data: existing } = await admin
      .from('user_credits')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ skipped: true })
    }

    // ボーナストークン付与
    await admin.from('user_credits').insert({
      user_id:         user.id,
      balance:         NEW_USER_BONUS_TOKENS,
      total_purchased: 0,
      total_used:      0,
    })

    await admin.from('credit_transactions').insert({
      user_id:     user.id,
      amount:      NEW_USER_BONUS_TOKENS,
      type:        'bonus',
      description: `新規登録ボーナス (${(NEW_USER_BONUS_TOKENS / 10_000).toFixed(0)}万トークン)`,
    })

    console.log(`🎁 Bonus granted: ${user.id} +${NEW_USER_BONUS_TOKENS} tokens`)
    return NextResponse.json({ granted: true, tokens: NEW_USER_BONUS_TOKENS })
  } catch (err) {
    console.error('[grant-bonus]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
