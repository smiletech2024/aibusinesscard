import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseek, MODEL } from '@/lib/anthropic'

function getExtractionPrompt(conversations: Array<{ role: string; content: string }>): string {
  const text = conversations.map(c => `${c.role === 'user' ? 'ユーザー' : 'AI'}: ${c.content}`).join('\n')
  return `以下のヒアリング会話から、分身AI用のデータをJSON形式で抽出してください。

【会話】
${text}

【出力形式（JSON）】
{
  "values_summary": "本人の価値観・信念・大切にしていること（200字以内）",
  "tone_profile": "話し方のスタイル（100字以内）",
  "faq_json": [{"question": "Q", "answer": "A"}],
  "achievements_json": [{"title": "実績タイトル", "description": "詳細"}],
  "forbidden_rules_json": ["NG事項1", "NG事項2"],
  "routing_rules_json": [{"intent": "相談したいこと", "action": "対応方法"}]
}

JSONのみ出力してください。`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversations, cardData } = await req.json()

    const response = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: getExtractionPrompt(conversations) }],
    })

    const rawText = response.choices[0]?.message?.content || ''

    let personaData
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      personaData = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      personaData = {}
    }

    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .insert({
        user_id: user.id,
        values_summary: personaData.values_summary || '',
        tone_profile: personaData.tone_profile || '',
        faq_json: personaData.faq_json || [],
        achievements_json: personaData.achievements_json || [],
        forbidden_rules_json: personaData.forbidden_rules_json || [],
        routing_rules_json: personaData.routing_rules_json || [],
      })
      .select()
      .single()

    if (personaError) {
      return NextResponse.json({ error: 'Failed to save persona' }, { status: 500 })
    }

    if (cardData) {
      await supabase.from('business_cards').insert({
        user_id: user.id,
        persona_id: persona.id,
        full_name: cardData.full_name,
        title: cardData.title,
        company: cardData.company,
        short_intro: cardData.short_intro,
        email: cardData.email || user.email,
        phone: cardData.phone,
        website: cardData.website,
      })
    }

    return NextResponse.json({ persona, personaId: persona.id })
  } catch (error) {
    console.error('Persona save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
