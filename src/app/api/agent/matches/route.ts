import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 自分が探した案件（outgoing）
    const { data: outgoing, error: e1 } = await supabase
      .from('agent_matches')
      .select('*')
      .eq('skill_user_id', user.id)
      .order('match_score', { ascending: false })
      .order('created_at',  { ascending: false })

    // 自分の課題に来た提案（incoming）— status が sent 以上のもの
    const { data: incoming, error: e2 } = await supabase
      .from('agent_matches')
      .select('*')
      .eq('need_user_id', user.id)
      .in('status', ['sent', 'replied', 'closed'])
      .order('created_at', { ascending: false })

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    return NextResponse.json({
      outgoing: outgoing ?? [],
      incoming: incoming ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
