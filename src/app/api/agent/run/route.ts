import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { deepseek, MODEL } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // サービスロール：RLSを超えて全ユーザーのデータを参照
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── 自分のスキルを取得 ──────────────────────────────
    const { data: mySkills } = await admin
      .from('user_skills')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(5)  // 最大5スキルまで処理

    if (!mySkills || mySkills.length === 0) {
      return NextResponse.json({ error: 'スキルを登録してからエージェントを実行してください' }, { status: 400 })
    }

    // ── 自分のプロフィールを取得（メッセージ生成用） ──
    const { data: myProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const { data: myCard } = await admin
      .from('business_cards')
      .select('company, title')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const myName    = myProfile?.full_name ?? 'ユーザー'
    const myCompany = myCard?.company ?? ''
    const myTitle   = myCard?.title ?? ''

    // ── 他ユーザーの公開課題を取得（最大40件） ─────────
    const { data: allNeeds } = await admin
      .from('user_needs')
      .select('*')
      .eq('is_public', true)
      .eq('is_active', true)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)

    if (!allNeeds || allNeeds.length === 0) {
      return NextResponse.json({ newCount: 0, message: '現在マッチングできる課題がありません。しばらくお待ちください。' })
    }

    // 課題オーナーのプロフィール＋名刺を一括取得
    const needUserIds = [...new Set(allNeeds.map(n => n.user_id))]

    const { data: needProfiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', needUserIds)

    const { data: needCards } = await admin
      .from('business_cards')
      .select('user_id, company, title')
      .in('user_id', needUserIds)
      .eq('is_active', true)

    const profileMap: Record<string, { name: string; company: string; title: string }> = {}
    for (const uid of needUserIds) {
      const profile = needProfiles?.find(p => p.id === uid)
      const card    = needCards?.find(c => c.user_id === uid)
      profileMap[uid] = {
        name:    profile?.full_name ?? '匿名ユーザー',
        company: card?.company ?? '',
        title:   card?.title ?? '',
      }
    }

    // ── スキルごとにマッチング実行 ────────────────────
    const newMatches: object[] = []

    for (const skill of mySkills) {
      // すでにマッチング済みの need_id を除外
      const { data: existing } = await admin
        .from('agent_matches')
        .select('need_id')
        .eq('skill_user_id', user.id)
        .eq('skill_id', skill.id)

      const existingIds = new Set((existing ?? []).map((m: { need_id: string }) => m.need_id))
      const candidates  = allNeeds.filter(n => !existingIds.has(n.id))
      if (candidates.length === 0) continue

      // DeepSeekに10件ずつバッチ送信
      const BATCH = 10
      for (let i = 0; i < Math.min(candidates.length, 20); i += BATCH) {
        const batch = candidates.slice(i, i + BATCH)
        const needsText = batch.map((n, idx) =>
          `[${idx}] id:${n.id}\n課題名:${n.title}\n詳細:${n.description}\n理想:${n.ideal_outcome ?? ''}\n予算:${n.budget_range}\n緊急度:${n.urgency}`
        ).join('\n\n')

        const prompt = `以下のスキル保有者と課題リストのマッチング度を JSON で返してください。

【スキル保有者のスキル】
分野: ${skill.title}
詳細: ${skill.description}
実績: ${skill.achievements ?? 'なし'}
理想クライアント: ${skill.ideal_client ?? '特になし'}

【課題リスト】
${needsText}

返答形式（JSONのみ・他のテキスト不要）:
{"results":[{"index":0,"need_id":"...","score":85,"reason":"マッチ理由を40字以内で"},{"index":1,...}]}

スコア60未満は含めない。完全にミスマッチな課題は除外してください。`

        try {
          const res = await deepseek.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 1500,
          })

          const raw = res.choices[0]?.message?.content ?? '{}'
          const jsonStr = raw.replace(/```json|```/g, '').trim()
          const parsed = JSON.parse(jsonStr)
          const results: { need_id: string; score: number; reason: string }[] = parsed.results ?? []

          for (const r of results) {
            if (!r.need_id || r.score < 60) continue
            const need = batch.find(n => n.id === r.need_id)
            if (!need) continue
            const needOwner = profileMap[need.user_id] ?? { name: '匿名', company: '', title: '' }

            newMatches.push({
              skill_user_id:        user.id,
              need_user_id:         need.user_id,
              skill_id:             skill.id,
              need_id:              need.id,
              match_score:          r.score,
              match_reason:         r.reason,
              // スキル側の非正規化
              skill_title:          skill.title,
              skill_category:       skill.category,
              skill_user_name:      myName,
              skill_user_company:   myCompany,
              skill_user_title_label: myTitle,
              // 課題側の非正規化
              need_title:           need.title,
              need_category:        need.category,
              need_description:     need.description,
              need_budget:          need.budget_range,
              need_urgency:         need.urgency,
              need_user_name:       needOwner.name,
              need_user_company:    needOwner.company,
              need_user_title_label: needOwner.title,
            })
          }
        } catch (e) {
          console.error('Matching batch error:', e)
          // バッチ失敗は無視して続行
        }
      }
    }

    // ── 新しいマッチを保存 ────────────────────────────
    if (newMatches.length > 0) {
      await admin.from('agent_matches').insert(newMatches)
    }

    return NextResponse.json({ newCount: newMatches.length })
  } catch (err) {
    console.error('agent/run error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
