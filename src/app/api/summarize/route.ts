import { NextRequest, NextResponse } from 'next/server'
import { deepseek, MODEL, getSummaryPrompt } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    const supabase = await createClient()

    const { data: conversations, error: convError } = await supabase
      .from('ai_conversations')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (convError || !conversations) {
      return NextResponse.json({ error: 'Conversations not found' }, { status: 404 })
    }

    const { data: session } = await supabase
      .from('customer_sessions')
      .select('personas(profiles:user_id(full_name)), business_cards(full_name)')
      .eq('id', sessionId)
      .single()

    const ownerName = (session as { personas?: { profiles?: { full_name?: string } }; business_cards?: { full_name?: string } } | null)?.business_cards?.full_name
      || (session as { personas?: { profiles?: { full_name?: string } }; business_cards?: { full_name?: string } } | null)?.personas?.profiles?.full_name
      || 'オーナー'

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

    await supabase
      .from('customer_sessions')
      .update({ status: 'summarized', summary_id: summary.id })
      .eq('id', sessionId)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summarize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
