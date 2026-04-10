import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
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
