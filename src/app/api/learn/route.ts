import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { personaId, question, answer } = await req.json()
    if (!personaId || !question || !answer) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // 所有者確認 + 現在のfaq取得
    const { data: persona } = await admin
      .from('personas')
      .select('user_id, faq_json')
      .eq('id', personaId)
      .single()

    if (!persona || persona.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentFaq: Array<{ question: string; answer: string }> = persona.faq_json || []

    // 同じ質問が既にあれば上書き、なければ追加
    const existingIdx = currentFaq.findIndex(f =>
      f.question.trim() === question.trim()
    )
    let newFaq
    if (existingIdx >= 0) {
      newFaq = currentFaq.map((f, i) => i === existingIdx ? { question, answer } : f)
    } else {
      newFaq = [...currentFaq, { question, answer }]
    }

    const { error } = await admin
      .from('personas')
      .update({ faq_json: newFaq, updated_at: new Date().toISOString() })
      .eq('id', personaId)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true, count: newFaq.length })
  } catch (error) {
    console.error('Learn error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
