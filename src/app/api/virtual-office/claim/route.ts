import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST: スロットを入居
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slot_id, card_id } = await req.json()
    if (!slot_id || !card_id) return NextResponse.json({ error: 'slot_id and card_id required' }, { status: 400 })

    const admin = adminClient()

    // すでに入居済みか確認
    const { data: existing } = await admin
      .from('virtual_office_slots')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'すでに入居しています。退去してから入居してください。' }, { status: 409 })
    }

    // 対象スロットが空いているか確認
    const { data: slot } = await admin
      .from('virtual_office_slots')
      .select('id, user_id')
      .eq('id', slot_id)
      .maybeSingle()

    if (!slot) return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 })
    if (slot.user_id) return NextResponse.json({ error: 'このスロットはすでに入居済みです' }, { status: 409 })

    // カード情報・プロフィールを取得
    const { data: card } = await admin
      .from('business_cards')
      .select('company, title')
      .eq('id', card_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    // 入居
    const { error } = await admin
      .from('virtual_office_slots')
      .update({
        user_id:      user.id,
        card_id:      card_id,
        company_name: card?.company ?? '',
        display_name: profile?.full_name ?? '',
        card_title:   card?.title ?? '',
        occupied_at:  new Date().toISOString(),
      })
      .eq('id', slot_id)
      .is('user_id', null)  // 競合防止

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('virtual-office claim POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 退去
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slot_id } = await req.json()
    if (!slot_id) return NextResponse.json({ error: 'slot_id required' }, { status: 400 })

    const admin = adminClient()

    const { error } = await admin
      .from('virtual_office_slots')
      .update({
        user_id:      null,
        card_id:      null,
        company_name: null,
        display_name: null,
        card_title:   null,
        occupied_at:  null,
      })
      .eq('id', slot_id)
      .eq('user_id', user.id)  // 自分のスロットのみ

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('virtual-office claim DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
