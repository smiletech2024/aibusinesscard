import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ユーザーのペルソナIDを取得
    const { data: personas } = await admin
      .from('personas')
      .select('id')
      .eq('user_id', user.id)

    if (!personas?.length) {
      return NextResponse.json({ hot: 0, warm: 0, cold: 0, topInterests: [], totalSessions: 0, summarizedSessions: 0 })
    }

    const personaIds = personas.map(p => p.id)

    // セッション一覧（直近90日）
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: sessions } = await admin
      .from('customer_sessions')
      .select('id, status, summary_id')
      .in('persona_id', personaIds)
      .gte('created_at', since)

    const totalSessions = sessions?.length ?? 0
    const summarizedSessions = sessions?.filter(s => s.summary_id).length ?? 0

    if (!summarizedSessions) {
      return NextResponse.json({ hot: 0, warm: 0, cold: 0, topInterests: [], totalSessions, summarizedSessions })
    }

    const summaryIds = sessions?.filter(s => s.summary_id).map(s => s.summary_id!) ?? []

    const { data: summaries } = await admin
      .from('conversation_summaries')
      .select('raw_summary')
      .in('id', summaryIds)

    let hot = 0, warm = 0, cold = 0
    const interestCount: Record<string, number> = {}

    for (const row of summaries ?? []) {
      try {
        const json = JSON.parse(row.raw_summary ?? '{}')

        // hot_score 集計
        const hs: string = json.hot_score ?? ''
        if (hs.includes('熱い') || hs.includes('🔥')) hot++
        else if (hs.includes('ぬるい') || hs.includes('🌡')) warm++
        else if (hs.includes('冷たい') || hs.includes('❄')) cold++

        // key_interests 集計
        const ki: string[] = Array.isArray(json.key_interests) ? json.key_interests : []
        for (const k of ki) {
          const trimmed = k.trim()
          if (trimmed) interestCount[trimmed] = (interestCount[trimmed] ?? 0) + 1
        }
      } catch { /* JSON parse error — skip */ }
    }

    const topInterests = Object.entries(interestCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }))

    return NextResponse.json({ hot, warm, cold, topInterests, totalSessions, summarizedSessions })
  } catch (err) {
    console.error('[analytics]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
