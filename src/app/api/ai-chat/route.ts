import { NextRequest, NextResponse } from 'next/server'
import { deepseek, anthropic, MODEL, FALLBACK_MODEL, getAvatarSystemPrompt } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcTokensConsumed } from '@/lib/credits'
import { logger } from '@/lib/logger'

// コンテキストウィンドウ爆発防止：直近20メッセージ（10往復）のみAIへ送信
const MAX_CONTEXT_MESSAGES = 20

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

      // ── セッション有効期限チェック ──────────────────────────────
      const { data: sessionRow } = await admin
        .from('customer_sessions')
        .select('expires_at')
        .eq('id', sessionId)
        .maybeSingle()

      if (sessionRow?.expires_at && new Date(sessionRow.expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'SESSION_EXPIRED', message: 'このセッションは有効期限（24時間）を過ぎています。' },
          { status: 410 }
        )
      }
    }

    // ── トークン残高チェック ──────────────────────────────────────
    const { data: credits } = await admin
      .from('user_credits')
      .select('balance, sub_balance')
      .eq('user_id', ownerId)
      .maybeSingle()

    const totalBalance = (credits?.sub_balance ?? 0) + (credits?.balance ?? 0)
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

    // コンテキスト爆発防止：直近 MAX_CONTEXT_MESSAGES 件のみ送信
    const contextMessages = Array.isArray(messages)
      ? messages.slice(-MAX_CONTEXT_MESSAGES)
      : messages

    let fullText         = ''
    let promptTokens     = 0
    let completionTokens = 0
    let usedFallback     = false

    // DeepSeek を試みて失敗したら Anthropic Claude にフォールバック
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let deepseekStream: AsyncIterable<any> | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let anthropicStream: AsyncIterable<any> | null = null

    try {
      deepseekStream = await deepseek.chat.completions.create({
        model:          MODEL,
        max_tokens:     1024,
        stream:         true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextMessages,
        ],
      })
    } catch (deepseekErr) {
      usedFallback = true
      logger.warn('ai-chat:deepseek_fallback', { persona_id: personaId, reason: String(deepseekErr) })
      anthropicStream = await anthropic.messages.create({
        model:      FALLBACK_MODEL,
        max_tokens: 1024,
        stream:     true,
        system:     systemPrompt,
        messages:   contextMessages,
      })
    }

    const encoder  = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (deepseekStream) {
            for await (const chunk of deepseekStream) {
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
          } else if (anthropicStream) {
            for await (const event of anthropicStream) {
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                const text = (event.delta.text as string) || ''
                if (text) {
                  fullText += text
                  controller.enqueue(encoder.encode(text))
                }
              }
              if (event.type === 'message_start') {
                promptTokens = event.message?.usage?.input_tokens ?? 0
              }
              if (event.type === 'message_delta') {
                completionTokens = event.usage?.output_tokens ?? 0
              }
            }
          }
        } catch (streamErr) {
          logger.error('ai-chat:stream_error', streamErr, { session_id: sessionId })
        }

        // AIレスポンスを保存
        if (sessionId && fullText) {
          await admin.from('ai_conversations').insert({
            session_id: sessionId,
            role:    'assistant',
            content: fullText,
          })
        }

        // ── トークン消費（原子的 RPC で競合状態を解消）────────────
        const consumed = calcTokensConsumed(promptTokens, completionTokens)
        if (consumed > 0) {
          // RPC で FOR UPDATE ロック付き原子的デクリメント
          const { error: rpcErr } = await admin.rpc('deduct_tokens', {
            p_user_id:  ownerId,
            p_consumed: consumed,
          })

          if (rpcErr) {
            // RPC 失敗時はトークン消費をスキップ（競合状態を避けるため read-then-write しない）
            // migration が未適用の場合のみ発生。本番では RPC が常に存在するはずなのでエラーログのみ。
            logger.error('ai-chat:rpc_deduct_failed', rpcErr, {
              owner_id: ownerId,
              consumed,
              hint: 'deduct_tokens RPC が見つかりません。supabase-migration.sql を実行してください',
            })
            // 課金記録は残しておく（後で手動調整可能）
          }

          await admin.from('credit_transactions').insert({
            user_id:           ownerId,
            amount:            -consumed,
            type:              'usage',
            description:       `分身AI会話${usedFallback ? '[fallback]' : ''} (入力${promptTokens}+出力${completionTokens}トークン)`,
            prompt_tokens:     promptTokens,
            completion_tokens: completionTokens,
            persona_id:        personaId,
          })

          logger.info('ai-chat:tokens_consumed', {
            owner_id: ownerId,
            consumed,
            model: usedFallback ? FALLBACK_MODEL : MODEL,
          })
        }

        controller.close()
      }
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  } catch (error) {
    logger.error('ai-chat:unhandled', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
