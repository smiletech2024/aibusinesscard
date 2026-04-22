import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: 新規追加
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { personaId, content } = await req.json()
    if (!personaId || !content?.trim()) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    // ペルソナがこのユーザーのものか確認
    const { data: persona } = await supabase
      .from('personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .single()

    if (!persona) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('quick_updates')
      .insert({ persona_id: personaId, content: content.trim() })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ update: data })
  } catch (err) {
    console.error('[quick-update POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET: 一覧取得
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const personaId = req.nextUrl.searchParams.get('personaId')
    if (!personaId) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const { data, error } = await supabase
      .from('quick_updates')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json({ updates: data ?? [] })
  } catch (err) {
    console.error('[quick-update GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE: 削除
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const { error } = await supabase
      .from('quick_updates')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[quick-update DELETE]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
