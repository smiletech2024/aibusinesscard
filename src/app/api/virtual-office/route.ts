import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const admin = adminClient()

    const { data: slots, error } = await admin
      .from('virtual_office_slots')
      .select('*')
      .order('area')
      .order('floor_num', { ascending: false })
      .order('slot_num')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ slots: slots ?? [] })
  } catch (err) {
    console.error('virtual-office GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
