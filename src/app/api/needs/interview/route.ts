import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseek, MODEL } from '@/lib/anthropic'

const SYSTEM_PROMPT = `あなたはビジネス課題のヒアリング専門AIです。
ユーザーが今抱えている課題を、自然な会話形式で5〜7回の質問でヒアリングし、最終的に構造化して整理します。

【ヒアリングの流れ】
1. まず「どんな分野で困っているか」大まかに聞く（営業/マーケ/技術/採用/財務/業務効率化など）
2. 「具体的にどんな状況か」現状を掘り下げる
3. 「なぜそうなっているのか」背景・根本原因を探る
4. 「解決したらどんな状態になりたいか」理想を引き出す
5. 「もし外部に依頼するとしたら、どのくらいの規模感をお考えですか？」と自然に予算感を聞く
6. 「いつ頃までに解決したいですか？」と緊急度を聞く

【会話ルール】
- 一度に質問は1つだけ
- 共感の言葉を入れてから次の質問へ（「なるほど、それは大変でしたね」など）
- 具体的な数字や事例を自然に引き出す
- 選択肢を提示することで回答しやすくする
- 5〜8ターンで完了させる
- 最初の一言：「こんにちは！今日はどんな課題についてお話しいただけますか？気軽にシェアしてください😊」

【完了時】すべてのヒアリングが終わったら「では、おうかがいした内容を整理しますね。」と伝え、必ず以下フォーマットで出力してください。

[[SUMMARY]]
{
  "category": "sales または marketing または tech または hiring または finance または ops または other",
  "title": "課題タイトル（20字以内・名詞形で）",
  "description": "課題の詳細説明（150字前後）",
  "ideal_outcome": "解決後の理想の状態（80字前後）",
  "budget_range": "free または under50k または 50-200k または 200k-1m または 1m+ または undisclosed",
  "urgency": "asap または 1month または 3months または 6months または no_limit"
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
    console.error('needs/interview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
