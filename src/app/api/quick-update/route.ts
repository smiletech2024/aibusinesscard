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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET: 一覧取得
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const personaId = req.nextUrl.searchParams.get('personaId')
    if (!personaId || !UUID_RE.test(personaId)) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    // 所有者確認（他ユーザーのペルソナを閲覧不可）
    const { data: persona } = await supabase
      .from('personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!persona) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabase
      .from('quick_updates')
      .select('id, content, created_at')
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
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    // 削除前に所有確認（update経由でuser_id一致のみ削除）
    const { data: update } = await supabase
      .from('quick_updates')
      .select('persona_id, personas!inner(user_id)')
      .eq('id', id)
      .maybeSingle()

    if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    type UpdateRow = { persona_id: string; personas: { user_id: string } }
    const row = update as unknown as UpdateRow
    if (row.personas?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
