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
          const scoreText = summaryData.compatibility_score ? `相性スコア: ${summaryData.compatibility_score}点` : ''
          const purposeText = summaryData.purpose ? `目的: ${summaryData.purpose}` : ''
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: FROM,
              to: ownerEmail,
              subject: `💬 ${customerName}さんとのAI会話まとめが届きました`,
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px">
                  <h2 style="color:#F26722">新しい相談まとめ</h2>
                  <p><strong>${customerName}</strong>さんがあなたのAI分身と会話しました。</p>
                  ${purposeText ? `<p style="background:#FFF7ED;padding:10px;border-radius:8px;border-left:3px solid #F26722">${purposeText}</p>` : ''}
                  ${scoreText ? `<p style="color:#059669;font-weight:bold">${scoreText}</p>` : ''}
                  <a href="${SITE_URL}/summary/${sessionId}" style="display:inline-block;background:#F26722;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">
                    まとめを確認する →
                  </a>
                  <p style="color:#9CA3AF;font-size:12px;margin-top:20px">AI名刺 · aimeishi.biz</p>
                </div>
              `,
            }),
          })
        }
      } catch (emailErr) {
        console.error('Summary email failed:', emailErr)
      }
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summarize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
