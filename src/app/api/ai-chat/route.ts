import { NextRequest, NextResponse } from 'next/server'
import { deepseek, MODEL, getAvatarSystemPrompt } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

    const { data: card } = await supabase
      .from('business_cards')
      .select('full_name, title')
      .eq('persona_id', personaId)
      .single()

    const ownerName = card?.full_name || (persona.profiles as { full_name?: string } | null)?.full_name || 'オーナー'
    const ownerTitle = card?.title || ''

    const systemPrompt = getAvatarSystemPrompt(persona, ownerName, ownerTitle)

    // ユーザーメッセージをサービスロールで保存
    if (sessionId && userMessage) {
      await admin.from('ai_conversations').insert({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
      })
    }

    const stream = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    let fullText = ''
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) {
            fullText += text
            controller.enqueue(encoder.encode(text))
          }
        }

        if (sessionId && fullText) {
          await admin.from('ai_conversations').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullText,
          })
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
