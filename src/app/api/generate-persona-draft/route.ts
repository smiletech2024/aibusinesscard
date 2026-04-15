import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseek, MODEL } from '@/lib/anthropic'

function getPersonaDraftPrompt(name: string, title: string, industry: string, keywords: string[]): string {
  return `以下のプロフィールを持つ人物の「分身AI用ペルソナ候補」を生成してください。

【プロフィール】
名前: ${name}
肩書き: ${title}
業種・分野: ${industry}
得意分野・キーワード: ${keywords.join('、')}

【出力形式（JSON）】
{
  "tones": [
    { "id": "1", "label": "丁寧・信頼感重視", "profile": "（この人らしい丁寧な話し方のスタイル説明。業種・キーワードを踏まえて具体的に。100字以内）" },
    { "id": "2", "label": "フレンドリー・親しみやすい", "profile": "（親しみやすいカジュアルな話し方スタイル。同様に具体的に。100字以内）" },
    { "id": "3", "label": "論理的・データ重視", "profile": "（数字・根拠を重視した話し方スタイル。同様に具体的に。100字以内）" }
  ],
  "values": [
    { "id": "v1", "text": "（この人の価値観・強み・信念の文章。キーワードと業種を盛り込み具体的に。150字程度）" },
    { "id": "v2", "text": "（別の切り口の価値観・強みの文章。異なる視点で。150字程度）" }
  ],
  "faqs": [
    { "id": "f1", "question": "（この業種・肩書きでよく聞かれる質問1）", "answer": "（${name}らしい自然な回答。具体的に）" },
    { "id": "f2", "question": "（よく聞かれる質問2）", "answer": "（回答）" },
    { "id": "f3", "question": "（よく聞かれる質問3）", "answer": "（回答）" },
    { "id": "f4", "question": "（よく聞かれる質問4）", "answer": "（回答）" },
    { "id": "f5", "question": "（よく聞かれる質問5）", "answer": "（回答）" },
    { "id": "f6", "question": "（よく聞かれる質問6）", "answer": "（回答）" }
  ],
  "forbidden": [
    "（この業種でやってはいけないこと1）",
    "（やってはいけないこと2）",
    "（やってはいけないこと3）"
  ]
}

業種・肩書き・キーワードに合った、リアルで具体的な内容を生成してください。JSONのみ出力してください。`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, title, industry, keywords } = await req.json()

    const response = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: getPersonaDraftPrompt(name, title, industry, keywords) }],
    })

    const rawText = response.choices[0]?.message?.content || ''
    let draft
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      draft = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      draft = {}
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Generate draft error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
