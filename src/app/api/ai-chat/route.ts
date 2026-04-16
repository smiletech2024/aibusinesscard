import { NextRequest, NextResponse } from 'next/server'
import { deepseek, MODEL, getAvatarSystemPrompt } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcTokensConsumed } from '@/lib/credits'

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId, personaId, userMessage } = await req.json()
    const supabase = await createClient()
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*, profiles:user_id(*)')
      .eq('id', personaId)
      .single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    const ownerId = persona.user_id as string

    // ── トークン残高チェック ──────────────────────────────────────
    const { data: credits } = await admin
      .from('user_credits')
      .select('balance')
      .eq('user_id', ownerId)
      .maybeSingle()

    const balance = credits?.balance ?? 0
    if (balance <= 0) {
      return NextResponse.json(
        { error: 'INSUFFICIENT_CREDITS', message: 'トークン残高が不足しています。オーナーがトークンを追加するまでしばらくお待ちください。' },
        { status: 402 }
      )
    }

    const { data: card } = await supabase
      .from('business_cards')
      .select('full_name, title')
      .eq('persona_id', personaId)
      .single()

    const ownerName  = card?.full_name || (persona.profiles as { full_name?: string } | null)?.full_name || 'オーナー'
    const ownerTitle = card?.title || ''

    const systemPrompt = getAvatarSystemPrompt(persona, ownerName, ownerTitle)

    // ユーザーメッセージをサービスロールで保存
    if (sessionId && userMessage) {
      await admin.from('ai_conversations').insert({
        session_id: sessionId,
        role:    'user',
        content: userMessage,
      })
    }

    const stream = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      stream_options: { include_usage: true },   // 使用量を最終チャンクで受け取る
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    let fullText      = ''
    let promptTokens  = 0
    let completionTokens = 0

    const encoder  = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }

          // 最終チャンクにusageが含まれる
          if (chunk.usage) {
            promptTokens     = chunk.usage.prompt_tokens     ?? 0
            completionTokens = chunk.usage.completion_tokens ?? 0
          }
        }

        // AIレスポンスを保存
        if (sessionId && fullText) {
          await admin.from('ai_conversations').insert({
            session_id: sessionId,
            role:    'assistant',
            content: fullText,
          })
        }

        // ── トークン消費を記録・残高を減算 ───────────────────────
        const consumed = calcTokensConsumed(promptTokens, completionTokens)
        if (consumed > 0) {
          // 取引ログ
          await admin.from('credit_transactions').insert({
            user_id:          ownerId,
            amount:           -consumed,
            type:             'usage',
            description:      `分身AI会話 (入力${promptTokens}+出力${completionTokens}トークン)`,
            prompt_tokens:    promptTokens,
            completion_tokens: completionTokens,
            persona_id:       personaId,
          })

          // 残高を更新（0以下にならないようにする）
          const { data: latest } = await admin
            .from('user_credits')
            .select('balance, total_used')
            .eq('user_id', ownerId)
            .maybeSingle()

          if (latest) {
            await admin.from('user_credits').update({
              balance:    Math.max(0, latest.balance - consumed),
              total_used: latest.total_used + consumed,
            }).eq('user_id', ownerId)
          }
        }

        controller.close()
      }
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
