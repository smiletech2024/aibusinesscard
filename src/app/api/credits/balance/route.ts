import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from('user_credits')
    .select('balance, total_purchased, total_used')
    .eq('user_id', user.id)
    .maybeSingle()

  // レコードなし → まだトークン付与前（0扱い）
  return NextResponse.json({
    balance:         data?.balance         ?? 0,
    total_purchased: data?.total_purchased ?? 0,
    total_used:      data?.total_used      ?? 0,
  })
}
