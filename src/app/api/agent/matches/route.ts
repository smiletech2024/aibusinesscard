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

    // 相手のカードIDを動的取得（マイグレーション不要・既存マッチも対応）
    const needUserIds  = [...new Set((outgoing  ?? []).map(m => m.need_user_id))]
    const skillUserIds = [...new Set((incoming  ?? []).map(m => m.skill_user_id))]
    const allUserIds   = [...new Set([...needUserIds, ...skillUserIds])]

    const cardIdMap: Record<string, string> = {}
    if (allUserIds.length > 0) {
      const { data: cards } = await supabase
        .from('business_cards')
        .select('id, user_id')
        .in('user_id', allUserIds)
        .eq('is_active', true)
      for (const card of cards ?? []) {
        cardIdMap[card.user_id] = card.id
      }
    }

    // 自分のカードIDも取得（incoming 側が skill_user のカードを見るため）
    const { data: myCards } = await supabase
      .from('business_cards')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
    const myCardId = myCards?.[0]?.id ?? null

    const outgoingWithCards = (outgoing ?? []).map(m => ({
      ...m,
      need_user_card_id:  cardIdMap[m.need_user_id]  ?? m.need_user_card_id  ?? null,
      skill_user_card_id: myCardId,
    }))

    const incomingWithCards = (incoming ?? []).map(m => ({
      ...m,
      skill_user_card_id: cardIdMap[m.skill_user_id] ?? m.skill_user_card_id ?? null,
      need_user_card_id:  myCardId,
    }))

    return NextResponse.json({
      outgoing: outgoingWithCards,
      incoming: incomingWithCards,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
