import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseek, MODEL } from '@/lib/anthropic'

// POST: アプローチメッセージを AI 生成し、status を 'interested' に更新
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { match_id } = await req.json()

    const { data: match, error } = await supabase
      .from('agent_matches')
      .select('*')
      .eq('id', match_id)
      .eq('skill_user_id', user.id)
      .single()

    if (error || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    // すでにメッセージがある場合はそのまま返す
    if (match.approach_message) {
      return NextResponse.json({ message: match.approach_message })
    }

    // AI でアプローチメッセージを生成
    const prompt = `あなたはビジネスマッチングをサポートするAIです。
以下の情報をもとに、提案者が課題保有者へ送る自然で誠実な初回アプローチメッセージを日本語で生成してください。

【提案者（あなた）のスキル】
得意分野: ${match.skill_title}
詳細: （スキル登録情報より）
所属: ${match.skill_user_company ?? ''}
肩書: ${match.skill_user_title_label ?? ''}
お名前: ${match.skill_user_name}

【相手の課題】
課題名: ${match.need_title}
詳細: ${match.need_description}
期待するゴール: ${match.need_urgency}
予算感: ${match.need_budget}

【生成ルール】
- 200字前後
- ビジネス文体だが堅すぎない
- 自分のスキルと相手の課題の接点を具体的に述べる
- 「ぜひ一度お話しできれば」で締める
- 件名・宛名は不要（本文のみ）
- 過度な敬語や決まり文句は避ける

メッセージ本文のみ出力してください。`

    const res = await deepseek.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    })

    const message = res.choices[0]?.message?.content?.trim() ?? ''

    // approach_message を保存し status を interested に更新
    await supabase
      .from('agent_matches')
      .update({ approach_message: message, status: 'interested', updated_at: new Date().toISOString() })
      .eq('id', match_id)
      .eq('skill_user_id', user.id)

    return NextResponse.json({ message })
  } catch (err) {
    console.error('approach POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: 編集済みメッセージを送信（status を 'sent' に）
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { match_id, message } = await req.json()

    const { error } = await supabase
      .from('agent_matches')
      .update({
        approach_message: message,
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', match_id)
      .eq('skill_user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
