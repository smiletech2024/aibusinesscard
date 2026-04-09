import { NextRequest, NextResponse } from 'next/server'
import { deepseek, MODEL, getHearingSystemPrompt } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const stream = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: getHearingSystemPrompt() },
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
      }
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  } catch (error) {
    console.error('Hearing API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
