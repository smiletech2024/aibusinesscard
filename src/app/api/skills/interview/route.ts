import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseek, MODEL } from '@/lib/anthropic'

const SYSTEM_PROMPT = `あなたはビジネスの強み・スキルを引き出すプロのコーチAIです。
ユーザーが自分の得意分野・提供できる価値を自信を持って表現できるよう、自然な会話でヒアリングします。

【ヒアリングの流れ】
1. 「どんなお仕事・サービスを提供されていますか？」と大まかに聞く
2. 「具体的にどんなことができますか？得意なことは？」と掘り下げる
3. 「過去にどんな成果・実績がありましたか？数字があれば教えてください」と実績を引き出す
4. 「どんなクライアント・案件が一番相性がいいですか？」と理想を聞く
5. 「あなたならではの強みや他との違いは何でしょうか？」と独自性を引き出す

【会話ルール】
- 一度に質問は1つだけ
- 謙遜している場合は「それはすごいですね！」と積極的に価値を認める
- 具体的な数字・事例を引き出す（「例えば売上〇%改善」など）
- 5〜7ターンで完了させる
- 最初の一言：「こんにちは！あなたが提供できるビジネスの価値について教えてください✨ どんなお仕事をされていますか？」

【完了時】「ありがとうございます！いただいた内容をまとめますね。」と伝え、必ず以下フォーマットで出力してください。

[[SUMMARY]]
{
  "category": "sales または marketing または tech または hiring または finance または ops または design または legal または other",
  "title": "得意分野タイトル（20字以内・名詞形で）",
  "description": "できること・提供価値の詳細（150字前後）",
  "achievements": "実績・成果（数字を含む具体例、100字前後）",
  "ideal_client": "理想のクライアント・案件像（80字前後）"
}
[[/SUMMARY]]`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages } = await req.json()

    const stream = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('skills/interview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
