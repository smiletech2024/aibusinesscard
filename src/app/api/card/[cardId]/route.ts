import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 所有者確認
    const { data: card } = await admin
      .from('business_cards')
      .select('user_id')
      .eq('id', cardId)
      .single()

    if (!card || card.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { full_name, title, company, short_intro, email, phone, website, style_config, cta_label, cta_url } = body

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // 名刺情報フィールド（style_configのみ送信する場合は undefined → 更新しない）
    if (full_name !== undefined) {
      payload.full_name   = full_name
      payload.title       = title       || null
      payload.company     = company     || null
      payload.short_intro = short_intro || null
      payload.email       = email       || null
      payload.phone       = phone       || null
      payload.website     = website     || null
    }

    // CTAフィールド
    if (cta_label !== undefined) payload.cta_label = cta_label || null
    if (cta_url   !== undefined) payload.cta_url   = cta_url   || null

    // style_config は image_url に JSON 文字列として保存
    if (style_config !== undefined) {
      payload.image_url = typeof style_config === 'string' ? style_config : JSON.stringify(style_config)
    }

    const { data: updated, error } = await admin
      .from('business_cards')
      .update(payload)
      .eq('id', cardId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ card: updated })
  } catch (error) {
    console.error('Card update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
