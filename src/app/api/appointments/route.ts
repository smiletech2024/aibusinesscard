import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { escapeHtml } from '@/lib/html-escape'
import { logger } from '@/lib/logger'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM    = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.aimeishi.biz'

const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/

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
    const { cardId, customerName, customerEmail, customerPhone, preferredDate, preferredTime, contactableTime, message } = body

    // ── 入力バリデーション ─────────────────────────────────────────
    if (!cardId || !UUID_RE.test(cardId)) {
      return NextResponse.json({ error: 'Invalid cardId' }, { status: 400 })
    }
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0 || customerName.length > 100) {
      return NextResponse.json({ error: 'customerName は必須・100文字以内です' }, { status: 400 })
    }
    if (customerEmail && (typeof customerEmail !== 'string' || customerEmail.length > 200 || !EMAIL_RE.test(customerEmail))) {
      return NextResponse.json({ error: 'Invalid customerEmail' }, { status: 400 })
    }
    if (customerPhone && (typeof customerPhone !== 'string' || customerPhone.length > 30 || !/^[\d\s\-+()]*$/.test(customerPhone))) {
      return NextResponse.json({ error: 'Invalid customerPhone' }, { status: 400 })
    }
    if (preferredDate && (typeof preferredDate !== 'string' || !DATE_RE.test(preferredDate))) {
      return NextResponse.json({ error: 'Invalid preferredDate' }, { status: 400 })
    }
    if (message && (typeof message !== 'string' || message.length > 2000)) {
      return NextResponse.json({ error: 'message は2000文字以内です' }, { status: 400 })
    }
    if (contactableTime && (typeof contactableTime !== 'string' || contactableTime.length > 200)) {
      return NextResponse.json({ error: 'contactableTime too long' }, { status: 400 })
    }

    const admin = getAdmin()

    // ── レートリミット（同一cardIdへの乱用防止） ──────────────────
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentCount } = await admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('card_id', cardId)
      .gte('created_at', oneMinuteAgo)

    if ((recentCount ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'RATE_LIMIT', message: 'アクセスが集中しています。しばらくしてからお試しください。' },
        { status: 429 }
      )
    }

    // カード情報を取得
    const { data: card, error: cardError } = await admin
      .from('business_cards')
      .select('id, full_name, user_id')
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // アポイントを保存
    const { data: appt, error: insertError } = await admin
      .from('appointments')
      .insert({
        card_id:          cardId,
        customer_name:    customerName.trim(),
        customer_email:   customerEmail?.trim().toLowerCase() || null,
        customer_phone:   customerPhone?.trim() || null,
        preferred_date:   preferredDate || null,
        preferred_time:   preferredTime || null,
        contactable_time: contactableTime?.trim() || null,
        message:          message?.trim() || null,
        status:           'pending',
      })
      .select()
      .single()

    if (insertError) {
      logger.error('appointments:insert_failed', insertError, { card_id: cardId })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    logger.info('appointments:created', { appointment_id: appt.id, card_id: cardId })

    // ── オーナーへのメール通知（fire-and-forget）──────────────────
    if (RESEND_API_KEY) {
      ;(async () => {
        try {
          const { data: profile } = await admin
            .from('profiles')
            .select('email')
            .eq('id', card.user_id)
            .maybeSingle()

          const ownerEmail = profile?.email
          if (!ownerEmail) return

          // 全フィールドをHTMLエスケープしてメールインジェクションを防止
          const safeName   = escapeHtml(customerName.trim())
          const safeEmail  = escapeHtml(customerEmail?.trim())
          const safePhone  = escapeHtml(customerPhone?.trim())
          const safeMsg    = escapeHtml(message?.trim())
          const safeTime   = escapeHtml(contactableTime?.trim())
          const safeCard   = escapeHtml(card.full_name)

          const dateStr = preferredDate
            ? escapeHtml(`${preferredDate}${preferredTime ? ' ' + preferredTime : ''}`)
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
                    <td style="padding:10px 0;color:#1C0F05;">${safeName}</td>
                  </tr>
                  ${safeEmail ? `<tr style="border-bottom:1px solid #F5E8DC;"><td style="padding:10px 0;color:#A08068;font-weight:600;">メール</td><td style="padding:10px 0;"><a href="mailto:${safeEmail}" style="color:#F26722;">${safeEmail}</a></td></tr>` : ''}
                  ${safePhone ? `<tr style="border-bottom:1px solid #F5E8DC;"><td style="padding:10px 0;color:#A08068;font-weight:600;">電話番号</td><td style="padding:10px 0;">${safePhone}</td></tr>` : ''}
                  <tr style="border-bottom:1px solid #F5E8DC;">
                    <td style="padding:10px 0;color:#A08068;font-weight:600;">希望日時</td>
                    <td style="padding:10px 0;color:#1C0F05;">${dateStr}</td>
                  </tr>
                  ${safeTime ? `<tr style="border-bottom:1px solid #F5E8DC;"><td style="padding:10px 0;color:#A08068;font-weight:600;">連絡可能時間</td><td style="padding:10px 0;color:#1C0F05;">${safeTime}</td></tr>` : ''}
                  ${safeMsg ? `<tr><td style="padding:10px 0;color:#A08068;font-weight:600;vertical-align:top;">ご用件</td><td style="padding:10px 0;color:#1C0F05;white-space:pre-wrap;">${safeMsg}</td></tr>` : ''}
                </table>
                <div style="margin-top:20px;text-align:center;">
                  <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#F26722,#F59340);color:#fff;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;">
                    ダッシュボードで確認する →
                  </a>
                </div>
              </div>
              <div style="background:#FAF5F0;padding:12px 24px;font-size:11px;color:#A08068;text-align:center;">
                AI名刺 — ${safeCard}の名刺からのアポイントリクエストです
              </div>
            </div>
          `

          await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
            body:    JSON.stringify({ from: FROM, to: [ownerEmail], subject: `📅 【AI名刺】${safeName}様からアポイントのご依頼`, html }),
          })
        } catch (emailErr) {
          logger.error('appointments:email_failed', emailErr, { card_id: cardId })
        }
      })()
    }

    return NextResponse.json({ ok: true, appointment: appt })
  } catch (err) {
    logger.error('appointments:unhandled', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
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
      logger.error('appointments:get_failed', error)
      return NextResponse.json({ appointments: [] })
    }

    const enriched = (appts ?? []).map(a => ({
      ...a,
      card_name: cardMap[a.card_id] ?? '不明',
    }))

    return NextResponse.json({ appointments: enriched })
  } catch (err) {
    logger.error('appointments:get_unhandled', err)
    return NextResponse.json({ appointments: [] })
  }
}

// ── DELETE：アポイント削除 ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()
    if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const admin = getAdmin()

    const { data: cards } = await admin
      .from('business_cards')
      .select('id')
      .eq('user_id', user.id)

    const cardIds = cards?.map(c => c.id) ?? []

    const { error } = await admin
      .from('appointments')
      .delete()
      .eq('id', id)
      .in('card_id', cardIds)

    if (error) return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('appointments:delete_unhandled', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── PATCH：ステータス更新 ─────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, status, ownerNote } = await req.json()
    if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'done']
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

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

    if (error) return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('appointments:patch_unhandled', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
