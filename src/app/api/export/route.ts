/**
 * GDPR / 個人情報保護法 対応データエクスポート
 * GET /api/export
 * 認証済みユーザー自身の全データを JSON でダウンロード
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ユーザーのペルソナ ID を先に取得（セッション絞り込みに使用）
    const { data: personaRows } = await admin
      .from('personas')
      .select('id')
      .eq('user_id', user.id)

    const personaIds = personaRows?.map(p => p.id) ?? []

    // 全テーブルを並行取得
    const [
      profileRes,
      personasRes,
      cardsRes,
      sessionsRes,
      creditsRes,
      transactionsRes,
      subscriptionRes,
    ] = await Promise.all([
      admin.from('profiles').select('id, email, full_name, avatar_url, created_at').eq('id', user.id).single(),
      admin.from('personas').select('id, values_summary, tone_profile, faq_json, achievements_json, is_active, created_at').eq('user_id', user.id),
      admin.from('business_cards').select('id, full_name, title, company, short_intro, email, phone, website, is_active, created_at').eq('user_id', user.id),
      personaIds.length > 0
        ? admin.from('customer_sessions').select('id, customer_name, customer_email, status, created_at').in('persona_id', personaIds).order('created_at', { ascending: false }).limit(1000)
        : Promise.resolve({ data: [] }),
      admin.from('user_credits').select('balance, sub_balance, total_purchased, total_used, sub_reset_at').eq('user_id', user.id).maybeSingle(),
      admin.from('credit_transactions').select('amount, type, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      admin.from('user_subscriptions').select('plan, status, current_period_start, current_period_end, cancel_at_period_end').eq('user_id', user.id).maybeSingle(),
    ])

    const exportData = {
      _meta: {
        exported_at:    new Date().toISOString(),
        user_id:        user.id,
        format_version: '1.0',
        notice:         'このファイルはAI名刺サービスに登録されたあなたの個人データです。',
      },
      profile:              profileRes.data,
      subscription:         subscriptionRes.data,
      credits:              creditsRes.data,
      personas:             personasRes.data ?? [],
      business_cards:       cardsRes.data ?? [],
      customer_sessions:    sessionsRes.data ?? [],
      credit_transactions:  transactionsRes.data ?? [],
    }

    const filename = `aimeishi-export-${new Date().toISOString().split('T')[0]}.json`

    logger.info('export:downloaded', { user_id: user.id })

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type':        'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    logger.error('export:failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
