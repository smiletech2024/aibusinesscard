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

    // ── レートリミット：セッション単位で過剰メッセージを防ぐ ──────
    if (sessionId) {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()

      // 直近1分のメッセージ数
      const { count: recentCount } = await admin
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('role', 'user')
        .gte('created_at', oneMinuteAgo)

      if ((recentCount ?? 0) >= 10) {
        return NextResponse.json(
          { error: 'RATE_LIMIT', message: '送信が速すぎます。少し待ってからもう一度お試しください。' },
          { status: 429 }
        )
      }

      // セッション累計メッセージ上限（トークン枯渇防止）
      const { count: totalCount } = await admin
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('role', 'user')

      if ((totalCount ?? 0) >= 80) {
        return NextResponse.json(
          { error: 'SESSION_LIMIT', message: 'この会話は上限に達しました。まとめへ進んでください。' },
          { status: 429 }
        )
      }
    }

    // ── トークン残高チェック（サブスク残高 + 購入残高）────────────
    const { data: credits } = await admin
      .from('user_credits')
      .select('balance, sub_balance')
      .eq('user_id', ownerId)
      .maybeSingle()

    const subBalance      = credits?.sub_balance ?? 0
    const purchasedBalance = credits?.balance    ?? 0
    const totalBalance     = subBalance + purchasedBalance

    if (totalBalance <= 0) {
      return NextResponse.json(
        {
          error:   'INSUFFICIENT_CREDITS',
          message: 'トークン残高が不足しています。オーナーがトークンを追加するまでしばらくお待ちください。',
        },
        { status: 402 }
      )
    }

    const { data: card } = await supabase
      .from('business_cards')
      .select('full_name, title, cta_label, cta_url')
      .eq('persona_id', personaId)
      .single()

    const ownerName  = card?.full_name || (persona.profiles as { full_name?: string } | null)?.full_name || 'オーナー'
    const ownerTitle = card?.title || ''

    // 最新情報（quick_updates）を取得
    const { data: quickUpdates } = await admin
      .from('quick_updates')
      .select('content, created_at')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(10)

    const systemPrompt = getAvatarSystemPrompt(
      persona,
      ownerName,
      ownerTitle,
      quickUpdates ?? [],
      (card as { cta_label?: string | null } | null)?.cta_label,
      (card as { cta_url?: string | null } | null)?.cta_url,
    )

    // ユーザーメッセージを保存
    if (sessionId && userMessage) {
      await admin.from('ai_conversations').insert({
        session_id: sessionId,
        role:    'user',
        content: userMessage,
      })
    }

    const stream = await deepseek.chat.completions.create({
      model:          MODEL,
      max_tokens:     1024,
      stream:         true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    let fullText         = ''
    let promptTokens     = 0
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

        // ── トークン消費：サブスク残高を先に使い、不足分は購入残高から ──
        const consumed = calcTokensConsumed(promptTokens, completionTokens)
        if (consumed > 0) {
          await admin.from('credit_transactions').insert({
            user_id:           ownerId,
            amount:            -consumed,
            type:              'usage',
            description:       `分身AI会話 (入力${promptTokens}+出力${completionTokens}トークン)`,
            prompt_tokens:     promptTokens,
            completion_tokens: completionTokens,
            persona_id:        personaId,
          })

          // 最新残高を再取得して更新
          const { data: latest } = await admin
            .from('user_credits')
            .select('balance, sub_balance, total_used')
            .eq('user_id', ownerId)
            .maybeSingle()

          if (latest) {
            // サブスク残高から先に消費
            const fromSub  = Math.min(latest.sub_balance, consumed)
            const fromPaid = Math.max(0, consumed - fromSub)

            await admin.from('user_credits').update({
              sub_balance: Math.max(0, latest.sub_balance - fromSub),
              balance:     Math.max(0, latest.balance     - fromPaid),
              total_used:  latest.total_used + consumed,
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
