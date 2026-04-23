import { NextRequest, NextResponse } from 'next/server'
import { deepseek, MODEL, getSummaryPrompt } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL = 'https://www.aimeishi.biz'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    const supabase = await createClient()
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: conversations, error: convError } = await admin
      .from('ai_conversations')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (convError || !conversations) {
      return NextResponse.json({ error: 'Conversations not found' }, { status: 404 })
    }

    const { data: session } = await admin
      .from('customer_sessions')
      .select('customer_name, personas(user_id, profiles:user_id(full_name, email)), business_cards(full_name)')
      .eq('id', sessionId)
      .single()

    type SessionData = {
      customer_name: string | null
      personas?: { user_id: string; profiles?: { full_name?: string; email?: string } } | null
      business_cards?: { full_name?: string } | null
    }
    const s = session as SessionData | null
    const ownerName = s?.business_cards?.full_name || s?.personas?.profiles?.full_name || 'オーナー'
    const customerName = s?.customer_name || 'お客様'
    const ownerUserId = s?.personas?.user_id

    const response = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: getSummaryPrompt(conversations, ownerName) }],
    })

    const rawSummary = response.choices[0]?.message?.content || ''

    let summaryData
    try {
      const jsonMatch = rawSummary.match(/\{[\s\S]*\}/)
      summaryData = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      summaryData = { raw_summary: rawSummary }
    }

    const { data: summary, error: summaryError } = await supabase
      .from('conversation_summaries')
      .insert({
        session_id: sessionId,
        purpose: summaryData.purpose || null,
        problems: summaryData.problems || null,
        interests: summaryData.interests || null,
        compatibility_score: summaryData.compatibility_score || null,
        unresolved_points: summaryData.unresolved_points || null,
        next_action: summaryData.next_action || null,
        raw_summary: rawSummary,
      })
      .select()
      .single()

    if (summaryError) {
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 })
    }

    await admin
      .from('customer_sessions')
      .update({ status: 'summarized', summary_id: summary.id })
      .eq('id', sessionId)

    // ── 熱い客スコア判定 ─────────────────────────────────────────────
    const score = parseInt(String(summaryData.compatibility_score ?? '0'), 10)
    const isHotLead = !isNaN(score) && score >= 80

    // ── オーナーへメール通知 ──────────────────────────────────────────
    if (ownerUserId && RESEND_API_KEY) {
      try {
        const { data: profile } = await admin
          .from('profiles')
          .select('email')
          .eq('id', ownerUserId)
          .maybeSingle()
        const ownerEmail = profile?.email
        if (ownerEmail) {
          const purposeText = summaryData.purpose || ''
          const nextAction  = summaryData.next_action || ''

          const hotBanner = isHotLead ? `
            <div style="background:#FEF3C7;border:2px solid #F59E0B;border-radius:12px;padding:16px;margin-bottom:20px">
              <div style="font-size:20px;margin-bottom:6px">🔥 熱い見込み客です！</div>
              <div style="font-size:14px;color:#92400E;font-weight:700">相性スコア ${score}点 — 今すぐ連絡することをおすすめします</div>
              ${nextAction ? `<div style="font-size:13px;color:#78350F;margin-top:8px">💡 ${nextAction}</div>` : ''}
            </div>` : ''

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: FROM,
              to: ownerEmail,
              subject: isHotLead
                ? `🔥 熱い見込み客！${customerName}さんとの会話まとめ（スコア${score}点）`
                : `💬 ${customerName}さんとのAI会話まとめが届きました`,
              html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
                  <div style="margin-bottom:20px">
                    <img src="${SITE_URL}/logo.png" alt="AI名刺" height="28" style="opacity:0.8" />
                  </div>
                  ${hotBanner}
                  <h2 style="color:#1C0F05;font-size:18px;margin:0 0 8px">新しい相談まとめ</h2>
                  <p style="color:#6B7280;font-size:14px;margin:0 0 20px">
                    <strong style="color:#1C0F05">${customerName}</strong>さんがあなたのAI分身と会話しました。
                  </p>
                  ${purposeText ? `
                    <div style="background:#FFF7ED;border-left:4px solid #F26722;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:16px">
                      <div style="font-size:11px;color:#A08068;font-weight:700;margin-bottom:4px">相談の目的</div>
                      <div style="font-size:14px;color:#1C0F05">${purposeText}</div>
                    </div>` : ''}
                  ${score > 0 ? `
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
                      <div style="font-size:13px;color:#6B7280">相性スコア</div>
                      <div style="font-size:20px;font-weight:900;color:${score >= 75 ? '#F59E0B' : score >= 50 ? '#F26722' : '#9CA3AF'}">${score}点</div>
                      <div style="font-size:12px;color:${score >= 75 ? '#D97706' : '#9CA3AF'}">${score >= 75 ? '🔥 高い' : score >= 50 ? '普通' : '低め'}</div>
                    </div>` : ''}
                  <a href="${SITE_URL}/summary/${sessionId}"
                    style="display:inline-block;background:linear-gradient(135deg,#F26722,#F59340);color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px">
                    まとめを確認する →
                  </a>
                  <p style="color:#D1D5DB;font-size:11px;border-top:1px solid #F3F4F6;padding-top:16px">
                    AI名刺 · <a href="${SITE_URL}" style="color:#D1D5DB">aimeishi.biz</a>
                  </p>
                </div>
              `,
            }),
          })
        }
      } catch (emailErr) {
        console.error('Summary email failed:', emailErr)
      }
    }

    // ── 熱い客プッシュ通知 ────────────────────────────────────────────
    if (isHotLead && ownerUserId && RESEND_API_KEY) {
      try {
        const { data: ownerSubs } = await admin
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', ownerUserId)
          .eq('role', 'owner')
        if (ownerSubs?.length) {
          const webpush = (await import('web-push')).default
          webpush.setVapidDetails(
            process.env.VAPID_SUBJECT!,
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
          )
          const payload = JSON.stringify({
            title: `🔥 熱い見込み客！スコア${score}点`,
            body: `${customerName}さん — 今すぐ連絡するチャンスです`,
            url: `/summary/${sessionId}`,
          })
          await Promise.allSettled(
            ownerSubs.map(({ subscription }) =>
              webpush.sendNotification(subscription as import('web-push').PushSubscription, payload)
            )
          )
        }
      } catch (pushErr) {
        console.error('Hot lead push failed:', pushErr)
      }
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summarize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
