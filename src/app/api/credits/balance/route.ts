import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLANS, type PlanId } from '@/lib/plans'
import { NEW_USER_BONUS_TOKENS } from '@/lib/credits'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [creditsResult, subResult, bonusTxResult] = await Promise.all([
    admin.from('user_credits').select('balance, sub_balance, total_purchased, total_used').eq('user_id', user.id).maybeSingle(),
    admin.from('user_subscriptions').select('plan, status').eq('user_id', user.id).maybeSingle(),
    admin.from('credit_transactions').select('id').eq('user_id', user.id).like('description', '%新規登録ボーナス%').maybeSingle(),
  ])

  let   purchased = creditsResult.data?.balance     ?? 0
  let   subBal    = creditsResult.data?.sub_balance ?? 0
  const totalUsed = creditsResult.data?.total_used  ?? 0
  const planId    = (subResult.data?.plan ?? 'free') as PlanId
  const status    = subResult.data?.status ?? 'active'

  const now = new Date().toISOString()

  // ── 自動修復①: 新規登録ボーナス未付与なら今すぐ付与 ──
  if (!bonusTxResult.data && purchased === 0) {
    purchased = NEW_USER_BONUS_TOKENS
    if (creditsResult.data) {
      // 行はあるが balance=0 → balance だけ更新
      await admin.from('user_credits').update({ balance: purchased }).eq('user_id', user.id)
    }
    // 行がない場合は下の sub_balance 修復 or 最後の insert で一緒に処理
    await admin.from('credit_transactions').insert({
      user_id:     user.id,
      amount:      NEW_USER_BONUS_TOKENS,
      type:        'bonus',
      description: `新規登録ボーナス (${(NEW_USER_BONUS_TOKENS / 10_000).toFixed(0)}万トークン)`,
    })
    console.log(`🎁 Auto-fixed bonus: user=${user.id} +${NEW_USER_BONUS_TOKENS}`)
  }

  // ── 自動修復②: 有料プランで sub_balance=0 なら今すぐ付与 ──
  const plan = PLANS[planId]
  if (plan && plan.monthlyTokens > 0 && subBal === 0 && status === 'active') {
    subBal = plan.monthlyTokens

    if (creditsResult.data) {
      await admin.from('user_credits').update({ sub_balance: subBal, sub_reset_at: now }).eq('user_id', user.id)
    } else {
      // 行がない（bonus 修復も未実行だった場合）→ まとめて insert
      await admin.from('user_credits').insert({
        user_id: user.id, balance: purchased, sub_balance: subBal,
        total_purchased: 0, total_used: 0, sub_reset_at: now,
      })
    }
    await admin.from('credit_transactions').insert({
      user_id:     user.id,
      amount:      subBal,
      type:        'bonus',
      description: `${plan.name}プラン 月次トークン自動修復付与`,
    })
    console.log(`🔧 Auto-fixed sub_balance: user=${user.id} plan=${planId} +${subBal}`)
  } else if (!creditsResult.data && !bonusTxResult.data) {
    // 行なし・フリープラン・ボーナス未付与 → ボーナスだけで行を作る
    await admin.from('user_credits').insert({
      user_id: user.id, balance: purchased, sub_balance: 0,
      total_purchased: 0, total_used: 0,
    })
  }

  return NextResponse.json({
    balance:         purchased,
    sub_balance:     subBal,
    total_balance:   purchased + subBal,
    total_purchased: creditsResult.data?.total_purchased ?? 0,
    total_used:      totalUsed,
    plan:            planId,
  })
}
