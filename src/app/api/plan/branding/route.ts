/**
 * 公開エンドポイント: チャット画面のブランド表示要否を返す
 * 認証不要（顧客のチャット画面から呼ばれる）
 * 返すのはブランディングフラグのみ（センシティブ情報なし）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLANS, type PlanId } from '@/lib/plans'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ showBranding: true })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from('user_subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()

  const planId = (data?.plan ?? 'free') as PlanId
  return NextResponse.json({ showBranding: PLANS[planId].showBranding })
}
