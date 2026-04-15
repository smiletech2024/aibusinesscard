import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 所有者確認
    const { data: persona } = await admin
      .from('personas')
      .select('user_id, values_summary, achievements_json')
      .eq('id', personaId)
      .single()

    if (!persona || persona.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { skills, projects, rawVoice } = await req.json()

    // values_summary の各セクションを構築（順序：ベース → スキル → 生の声）
    const stripped = (persona.values_summary || '')
      .replace(/\n\n【スキルセット・専門領域】[\s\S]*$/, '')
      .replace(/\n\n【本人の生の声・文体サンプル】[\s\S]*$/, '')
    const skillsSection = skills?.length > 0
      ? `\n\n【スキルセット・専門領域】\n${skills.map((s: string) => `・${s}`).join('\n')}`
      : ''
    const rawVoiceSection = rawVoice?.trim()
      ? `\n\n【本人の生の声・文体サンプル】\n${rawVoice.trim()}`
      : ''
    const newValues = stripped + skillsSection + rawVoiceSection

    // achievements_json に案件データを格納
    const newAchievements = (projects || []).map((p: {
      title: string; challenge: string; approach: string; result: string; tech: string
    }) => ({
      title: p.title,
      description: [
        p.challenge ? `課題: ${p.challenge}` : '',
        p.approach ? `アプローチ: ${p.approach}` : '',
        p.result ? `結果: ${p.result}` : '',
        p.tech ? `使用技術・手法: ${p.tech}` : '',
      ].filter(Boolean).join('\n'),
    }))

    const { error } = await admin
      .from('personas')
      .update({
        values_summary: newValues,
        achievements_json: newAchievements,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personaId)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Persona update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
