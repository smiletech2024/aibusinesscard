import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM      = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL  = 'https://www.aimeishi.biz'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Vercel Cron または外部から呼ばれる（毎週月曜 9:00 JST）
// Authorization: Bearer CRON_SECRET で保護
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'No RESEND_API_KEY' }, { status: 500 })
  }

  const admin = getAdmin()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  const prevSevenDays = new Date(Date.now() - 14 * 86400 * 1000).toISOString()

  // アクティブな名刺を持つユーザーを全取得
  const { data: cards } = await admin
    .from('business_cards')
    .select('id, user_id, full_name')
    .eq('is_active', true)

  if (!cards?.length) return NextResponse.json({ sent: 0 })

  // ユーザーごとにグループ化
  const byUser: Record<string, { cardIds: string[]; cardName: string }> = {}
  for (const c of cards) {
    if (!byUser[c.user_id]) byUser[c.user_id] = { cardIds: [], cardName: c.full_name }
    byUser[c.user_id].cardIds.push(c.id)
  }

  let sent = 0

  for (const [userId, { cardIds, cardName }] of Object.entries(byUser)) {
    try {
      // プロフィール（メール）取得
      const { data: profile } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle()

      if (!profile?.email) continue

      // 配信停止チェック
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      if (authUser?.user?.user_metadata?.email_unsubscribed) continue

      // 今週・先週のセッション数
      const [thisWeek, lastWeek, thisWeekAppt, lastWeekAppt] = await Promise.all([
        admin.from('customer_sessions').select('id', { count: 'exact' })
          .in('card_id', cardIds).gte('created_at', sevenDaysAgo),
        admin.from('customer_sessions').select('id', { count: 'exact' })
          .in('card_id', cardIds).gte('created_at', prevSevenDays).lt('created_at', sevenDaysAgo),
        admin.from('appointments').select('id', { count: 'exact' })
          .in('card_id', cardIds).gte('created_at', sevenDaysAgo),
        admin.from('appointments').select('id', { count: 'exact' })
          .in('card_id', cardIds).gte('created_at', prevSevenDays).lt('created_at', sevenDaysAgo),
      ])

      const sessCount     = thisWeek.count ?? 0
      const prevSessCount = lastWeek.count ?? 0
      const apptCount     = thisWeekAppt.count ?? 0
      const prevApptCount = lastWeekAppt.count ?? 0

      // セッションが0件なら送らない
      if (sessCount === 0 && apptCount === 0) continue

      // よく聞かれた質問（今週のセッションIDから）
      const { data: sessions } = await admin
        .from('customer_sessions').select('id')
        .in('card_id', cardIds).gte('created_at', sevenDaysAgo).limit(100)
      const sessionIds = (sessions ?? []).map(s => s.id)
      let topQText = ''
      if (sessionIds.length) {
        const { data: msgs } = await admin
          .from('ai_conversations')
          .select('content, session_id')
          .in('session_id', sessionIds)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(200)
        const firstMsg: Record<string, string> = {}
        for (const m of (msgs ?? [])) {
          if (!firstMsg[m.session_id]) firstMsg[m.session_id] = m.content
        }
        const freq: Record<string, number> = {}
        for (const q of Object.values(firstMsg)) {
          const key = q.slice(0, 40).trim()
          freq[key] = (freq[key] ?? 0) + 1
        }
        const top = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 3)
        topQText = top.map(([q, c], i) =>
          `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #F5E8DC">
            <span style="width:20px;height:20px;border-radius:50%;background:#F26722;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
            <span style="font-size:13px;color:#1C0F05;flex:1">${q}${q.length >= 40 ? '…' : ''}</span>
            ${c > 1 ? `<span style="font-size:11px;color:#F26722;font-weight:700;flex-shrink:0">${c}回</span>` : ''}
          </div>`
        ).join('')
      }

      // 先週比表示
      const sessDiff  = sessCount - prevSessCount
      const diffColor = sessDiff > 0 ? '#059669' : sessDiff < 0 ? '#EF4444' : '#9CA3AF'
      const diffText  = sessDiff > 0 ? `▲${sessDiff}` : sessDiff < 0 ? `▼${Math.abs(sessDiff)}` : '±0'

      // AIアドバイス
      let advice = ''
      if (apptCount === 0 && sessCount >= 3) {
        advice = '💡 <strong>相談は来ています。</strong>FAQに「料金」「納期」「実績」を追加すると、アポ転換率が上がる傾向があります。'
      } else if (sessCount === 0) {
        advice = '💡 名刺のQRコードをSNSのプロフィールや署名に追加すると、相談数が増えやすくなります。'
      } else if (apptCount >= 1) {
        advice = `🎉 <strong>今週${apptCount}件のアポ依頼</strong>が来ています！早めに連絡して成約につなげましょう。`
      }

      const ownerName = profile.full_name || cardName

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM,
          to: profile.email,
          subject: `📊 週次レポート｜${sessCount}件の相談、アポ${apptCount}件（${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}週）`,
          html: `
            <div style="font-family:'Hiragino Sans',sans-serif;max-width:540px;margin:0 auto;background:#FAF5F0;padding:0;border-radius:16px;overflow:hidden">

              <!-- ヘッダー -->
              <div style="background:linear-gradient(135deg,#C4511A,#F26722);padding:28px 24px;color:white">
                <div style="font-size:11px;opacity:0.8;margin-bottom:4px">AI名刺 週次レポート</div>
                <div style="font-size:20px;font-weight:900">${ownerName}さんの今週の成果</div>
                <div style="font-size:12px;opacity:0.75;margin-top:4px">${new Date(sevenDaysAgo).toLocaleDateString('ja-JP')} 〜 ${new Date().toLocaleDateString('ja-JP')}</div>
              </div>

              <!-- KPI -->
              <div style="padding:20px 24px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
                  <div style="background:white;border-radius:12px;padding:16px;text-align:center;border:1px solid #EDD9C8">
                    <div style="font-size:32px;font-weight:900;color:#F26722">${sessCount}</div>
                    <div style="font-size:11px;color:#A08068;margin-top:2px">今週の相談数</div>
                    <div style="font-size:11px;font-weight:700;color:${diffColor};margin-top:4px">先週比 ${diffText}</div>
                  </div>
                  <div style="background:white;border-radius:12px;padding:16px;text-align:center;border:1px solid #EDD9C8">
                    <div style="font-size:32px;font-weight:900;color:${apptCount > 0 ? '#059669' : '#9CA3AF'}">${apptCount}</div>
                    <div style="font-size:11px;color:#A08068;margin-top:2px">アポ依頼</div>
                    <div style="font-size:11px;color:#A08068;margin-top:4px">先週 ${prevApptCount}件</div>
                  </div>
                </div>

                ${topQText ? `
                <!-- よく聞かれた質問 -->
                <div style="background:white;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #EDD9C8">
                  <div style="font-size:12px;font-weight:700;color:#A08068;margin-bottom:12px">💬 今週よく聞かれた質問</div>
                  ${topQText}
                </div>` : ''}

                ${advice ? `
                <!-- AIアドバイス -->
                <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#92400E;line-height:1.6">
                  ${advice}
                </div>` : ''}

                <!-- CTA -->
                <a href="${SITE_URL}/dashboard"
                  style="display:block;background:linear-gradient(135deg,#F26722,#F59340);color:white;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:12px">
                  ダッシュボードを確認する →
                </a>
                <a href="${SITE_URL}/edit-persona"
                  style="display:block;background:white;color:#F26722;text-align:center;padding:12px;border-radius:12px;text-decoration:none;font-weight:700;font-size:13px;border:1.5px solid rgba(242,103,34,0.3)">
                  AIをアップデートする
                </a>
              </div>

              <div style="padding:16px 24px;text-align:center;font-size:11px;color:#C4A882">
                AI名刺 · <a href="${SITE_URL}" style="color:#C4A882">aimeishi.biz</a>
                · <a href="${SITE_URL}/unsubscribe?userId=${userId}" style="color:#C4A882">メール配信停止</a>
              </div>
            </div>
          `,
        }),
      })

      sent++
    } catch (err) {
      console.error(`Weekly report failed for user ${userId}:`, err)
    }
  }

  return NextResponse.json({ sent, total: Object.keys(byUser).length })
}
