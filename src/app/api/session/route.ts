import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { personaId, cardId, customerName, customerEmail } = await req.json()

    const { data: session, error } = await supabase
      .from('customer_sessions')
      .insert({
        persona_id: personaId,
        card_id: cardId || null,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        status: 'ai_chat',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Session create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
