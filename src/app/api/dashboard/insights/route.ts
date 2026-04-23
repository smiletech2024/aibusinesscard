import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString()

  // ユーザーの名刺ID一覧
  const { data: cards } = await admin
    .from('business_cards').select('id').eq('user_id', user.id).eq('is_active', true)
  const cardIds = (cards ?? []).map((c: { id: string }) => c.id)

  if (!cardIds.length) {
    return NextResponse.json({
      totalSessions: 0, thisMonthSessions: 0,
      topQuestions: [], appointmentCount: 0,
      appointmentsThisMonth: 0, conversionRate: 0,
    })
  }

  // セッション数・アポ数を並列取得
  const [sessionsAll, sessionsMonth, apptAll, apptMonth] = await Promise.all([
    admin.from('customer_sessions').select('id', { count: 'exact' }).in('card_id', cardIds),
    admin.from('customer_sessions').select('id', { count: 'exact' }).in('card_id', cardIds).gte('created_at', startOfMonth),
    admin.from('appointments').select('*', { count: 'exact', head: true }).in('card_id', cardIds),
    admin.from('appointments').select('*', { count: 'exact', head: true }).in('card_id', cardIds).gte('created_at', startOfMonth),
  ])

  // よく聞かれた質問TOP3（過去30日のユーザー発言から）
  const sessionIds = (sessionsAll.data ?? []).map((s: { id: string }) => s.id).slice(0, 500)
  let topQuestions: { question: string; count: number }[] = []

  if (sessionIds.length > 0) {
    const { data: msgs } = await admin
      .from('ai_conversations')
      .select('content, session_id')
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(300)

    // セッションごとの最初のメッセージのみ抽出
    const firstMsg: Record<string, string> = {}
    for (const m of (msgs ?? [])) {
      if (!firstMsg[m.session_id]) firstMsg[m.session_id] = m.content
    }

    // 頻度カウント（先頭40文字で正規化）
    const freq: Record<string, number> = {}
    for (const q of Object.values(firstMsg)) {
      const key = q.slice(0, 40).trim()
      freq[key] = (freq[key] ?? 0) + 1
    }
    topQuestions = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([question, count]) => ({ question, count }))
  }

  const totalSessions      = sessionsAll.count ?? 0
  const thisMonthSessions  = sessionsMonth.count ?? 0
  const appointmentCount   = apptAll.count ?? 0
  const appointmentsThisMonth = apptMonth.count ?? 0
  const conversionRate     = totalSessions > 0 ? Math.round(appointmentCount / totalSessions * 100) : 0

  return NextResponse.json({
    totalSessions, thisMonthSessions,
    topQuestions, appointmentCount,
    appointmentsThisMonth, conversionRate,
  })
}
