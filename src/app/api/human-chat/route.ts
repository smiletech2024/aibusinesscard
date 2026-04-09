import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { sessionId, senderRole, content } = await req.json()

    const { data: chat, error } = await supabase
      .from('human_chats')
      .insert({
        session_id: sessionId,
        sender_role: senderRole,
        content,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    // owner_chatステータスに更新
    await supabase
      .from('customer_sessions')
      .update({ status: 'owner_chat' })
      .eq('id', sessionId)

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('Human chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const { data: chats, error } = await supabase
      .from('human_chats')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
    }

    return NextResponse.json({ chats })
  } catch (error) {
    console.error('Human chat fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
