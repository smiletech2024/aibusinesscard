import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { deepseek, MODEL } from '@/lib/anthropic'
import { PLANS, canAddCard, canAddPersona, type PlanId } from '@/lib/plans'

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

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── プラン制限チェック ────────────────────────────────────────
    const { data: sub } = await admin
      .from('user_subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()

    const planId = (sub?.plan ?? 'free') as PlanId
    const plan   = PLANS[planId]

    // ペルソナ数チェック
    const { count: personaCount } = await admin
      .from('personas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!canAddPersona(planId, personaCount ?? 0)) {
      return NextResponse.json(
        {
          error:   'PLAN_LIMIT_EXCEEDED',
          message: `${plan.name}プランのペルソナ上限（${plan.maxPersonas}個）に達しています。プランをアップグレードしてください。`,
          upgradeRequired: true,
        },
        { status: 403 }
      )
    }

    const { conversations, cardData, draftSelections } = await req.json()

    let personaData
    if (draftSelections) {
      // 新フロー：ドラフト選択から直接生成（AI抽出不要）
      personaData = {
        values_summary: draftSelections.values || '',
        tone_profile: draftSelections.tone || '',
        faq_json: draftSelections.faqs || [],
        achievements_json: [],
        forbidden_rules_json: draftSelections.forbidden || [],
        routing_rules_json: [],
      }
    } else {
      // 旧フロー：ヒアリング会話から抽出
      const response = await deepseek.chat.completions.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: getExtractionPrompt(conversations || []) }],
      })
      const rawText = response.choices[0]?.message?.content || ''
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        personaData = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      } catch {
        personaData = {}
      }
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
      // 名刺枚数チェック
      const { count: cardCount } = await admin
        .from('business_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (!canAddCard(planId, cardCount ?? 0)) {
        return NextResponse.json(
          {
            error:   'PLAN_LIMIT_EXCEEDED',
            message: `${plan.name}プランの名刺上限（${plan.maxCards}枚）に達しています。プランをアップグレードしてください。`,
            upgradeRequired: true,
          },
          { status: 403 }
        )
      }

      await supabase.from('business_cards').insert({
        user_id: user.id,
        persona_id: persona.id,
        full_name: cardData.full_name,
        title: cardData.title,
        company: cardData.company,
        short_intro: cardData.short_intro,
        email: cardData.email || '',
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
