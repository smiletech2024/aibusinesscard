import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { cardId: string } }
) {
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
      .eq('id', params.cardId)
      .single()

    if (!card || card.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { full_name, title, company, short_intro, email, phone, website } = await req.json()

    const { data: updated, error } = await admin
      .from('business_cards')
      .update({
        full_name,
        title: title || null,
        company: company || null,
        short_intro: short_intro || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.cardId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ card: updated })
  } catch (error) {
    console.error('Card update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
