import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL = 'https://www.aimeishi.biz'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── POST：アポイント作成（QRスキャンした顧客が実行） ─────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cardId, customerName, customerEmail, customerPhone, preferredDate, preferredTime, message } = body

    console.log('[appointments POST] body:', { cardId, customerName, customerEmail, customerPhone })

    if (!cardId || !customerName) {
      return NextResponse.json({ error: 'cardId と customerName は必須です' }, { status: 400 })
    }

    const admin = getAdmin()

    // カード情報を取得
    const { data: card, error: cardError } = await admin
      .from('business_cards')
      .select('id, full_name, user_id')
      .eq('id', cardId)
      .single()

    console.log('[appointments POST] card:', card, 'cardError:', cardError)

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found', detail: cardError?.message }, { status: 404 })
    }

    // アポイントを保存
    const { data: appt, error: insertError } = await admin
      .from('appointments')
      .insert({
        card_id:        cardId,
        customer_name:  customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        preferred_date: preferredDate || null,
        preferred_time: preferredTime || null,
        message:        message || null,
        status:         'pending',
      })
      .select()
      .single()

    console.log('[appointments POST] insert:', appt, 'insertError:', insertError)

    if (insertError) {
      console.error('[appointments POST] DB error:', insertError)
      return NextResponse.json({ error: 'DB error', detail: insertError.message }, { status: 500 })
    }

    // オーナーのメールアドレスをprofilesテーブルから取得
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', card.user_id)
      .single()

    console.log('[appointments POST] owner profile:', profile)

    // オーナーへのメール通知（Resend）
    const ownerEmail = profile?.email
    if (ownerEmail && RESEND_API_KEY) {
      const dateStr = preferredDate
        ? `${preferredDate}${preferredTime ? ' ' + preferredTime : ''}`
        : '未指定'

      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #EDD9C8;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#C4511A,#F26722);padding:20px 24px;">
            <h1 style="margin:0;color:#fff;font-size:18px;">📅 アポイントのご依頼が届きました</h1>
          </div>
          <div style="padding:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr style="border-bottom:1px solid #F5E8DC;">
                <td style="padding:10px 0;color:#A08068;width:120px;font-weight:600;">お名前</td>
                <td style="padding:10px 0;color:#1C0F05;">${customerName}</td>
              </tr>
              ${customerEmail ? `<tr style="border-bottom:1px solid #F5E8DC;"><td style="padding:10px 0;color:#A08068;font-weight:600;">メール</td><td style="padding:10px 0;"><a href="mailto:${customerEmail}" style="color:#F26722;">${customerEmail}</a></td></tr>` : ''}
              ${customerPhone ? `<tr style="border-bottom:1px solid #F5E8DC;"><td style="padding:10px 0;color:#A08068;font-weight:600;">電話番号</td><td style="padding:10px 0;"><a href="tel:${customerPhone}" style="color:#F26722;">${customerPhone}</a></td></tr>` : ''}
              <tr style="border-bottom:1px solid #F5E8DC;">
                <td style="padding:10px 0;color:#A08068;font-weight:600;">希望日時</td>
                <td style="padding:10px 0;color:#1C0F05;">${dateStr}</td>
              </tr>
              ${message ? `<tr><td style="padding:10px 0;color:#A08068;font-weight:600;vertical-align:top;">ご用件</td><td style="padding:10px 0;color:#1C0F05;white-space:pre-wrap;">${message}</td></tr>` : ''}
            </table>
            <div style="margin-top:20px;text-align:center;">
              <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#F26722,#F59340);color:#fff;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;">
                ダッシュボードで確認する →
              </a>
            </div>
          </div>
          <div style="background:#FAF5F0;padding:12px 24px;font-size:11px;color:#A08068;text-align:center;">
            AI名刺 — ${card.full_name}の名刺からのアポイントリクエストです
          </div>
        </div>
      `

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM,
          to: [ownerEmail],
          subject: `📅 【AI名刺】${customerName}様からアポイントのご依頼`,
          html,
        }),
      })
      console.log('[appointments POST] resend status:', resendRes.status)
    } else {
      console.log('[appointments POST] skipping email: ownerEmail=', ownerEmail, 'RESEND_API_KEY=', !!RESEND_API_KEY)
    }

    return NextResponse.json({ ok: true, appointment: appt })
  } catch (err) {
    console.error('[appointments POST] unexpected error:', err)
    return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
  }
}

// ── GET：オーナーが自分のアポイントを取得 ─────────────────────────
export async function GET() {
  try {
    const supabase = await createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = getAdmin()

    const { data: cards } = await admin
      .from('business_cards')
      .select('id, full_name')
      .eq('user_id', user.id)

    if (!cards?.length) return NextResponse.json({ appointments: [] })

    const cardIds = cards.map(c => c.id)
    const cardMap = Object.fromEntries(cards.map(c => [c.id, c.full_name]))

    const { data: appts, error } = await admin
      .from('appointments')
      .select('*')
      .in('card_id', cardIds)
      .order('created_at', { ascending: false })

    if (error) {
      // テーブルが存在しない場合は空配列を返す
      console.error('[appointments GET]', error)
      return NextResponse.json({ appointments: [] })
    }

    const enriched = (appts ?? []).map(a => ({
      ...a,
      card_name: cardMap[a.card_id] ?? '不明',
    }))

    return NextResponse.json({ appointments: enriched })
  } catch (err) {
    console.error('[appointments GET]', err)
    return NextResponse.json({ appointments: [] })
  }
}

// ── PATCH：ステータス更新 ─────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, status, ownerNote } = await req.json()
    if (!id || !status) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const admin = getAdmin()

    const { data: cards } = await admin
      .from('business_cards')
      .select('id')
      .eq('user_id', user.id)

    const cardIds = cards?.map(c => c.id) ?? []

    const { error } = await admin
      .from('appointments')
      .update({ status, owner_note: ownerNote ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('card_id', cardIds)

    if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[appointments PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
