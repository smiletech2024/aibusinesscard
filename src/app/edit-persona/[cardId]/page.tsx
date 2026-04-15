'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, KeyboardEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Project {
  id: string
  title: string
  challenge: string
  approach: string
  result: string
  tech: string
}

function newProject(): Project {
  return { id: crypto.randomUUID(), title: '', challenge: '', approach: '', result: '', tech: '' }
}

export default function EditPersonaPage() {
  const { cardId } = useParams() as { cardId: string }
  const router = useRouter()
  const supabase = createClient()

  const [personaId, setPersonaId] = useState('')
  const [rawVoice, setRawVoice] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [projects, setProjects] = useState<Project[]>([newProject()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: card } = await supabase
        .from('business_cards')
        .select('persona_id, personas(*)')
        .eq('id', cardId)
        .eq('user_id', user.id)
        .single()

      if (!card?.persona_id) { router.push('/dashboard'); return }

      setPersonaId(card.persona_id)

      const persona = card.personas as { values_summary?: string; achievements_json?: Array<{ title: string; description: string }> }
      if (persona?.values_summary) {
        // スキル読み込み
        const skillMatch = persona.values_summary.match(/【スキルセット・専門領域】\n([\s\S]*?)(?:\n\n|$)/)
        if (skillMatch) {
          const existing = skillMatch[1].split('\n').map(s => s.replace(/^・/, '').trim()).filter(Boolean)
          setSkills(existing)
        }
        // 生の声読み込み
        const rawMatch = persona.values_summary.match(/【本人の生の声・文体サンプル】\n([\s\S]*)$/)
        if (rawMatch) setRawVoice(rawMatch[1].trim())
      }

      // 既存案件の読み込み
      if (persona?.achievements_json?.length) {
        const loaded = persona.achievements_json.map(a => {
          const lines: Record<string, string> = {}
          a.description?.split('\n').forEach(line => {
            const [k, ...v] = line.split(': ')
            lines[k] = v.join(': ')
          })
          return {
            id: crypto.randomUUID(),
            title: a.title || '',
            challenge: lines['課題'] || '',
            approach: lines['アプローチ'] || '',
            result: lines['結果'] || '',
            tech: lines['使用技術・手法'] || '',
          }
        })
        setProjects(loaded.length > 0 ? loaded : [newProject()])
      }
      setLoading(false)
    }
    load()
  }, [cardId])

  const addSkill = (kw: string) => {
    const t = kw.replace(/,/g, '').trim()
    if (t && !skills.includes(t) && skills.length < 20) setSkills(p => [...p, t])
    setKwInput('')
  }
  const handleKwKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(kwInput) }
    else if (e.key === 'Backspace' && !kwInput && skills.length > 0) setSkills(p => p.slice(0, -1))
  }

  const updateProject = (id: string, field: keyof Project, value: string) => {
    setProjects(p => p.map(proj => proj.id === id ? { ...proj, [field]: value } : proj))
  }
  const addProject = () => setProjects(p => [...p, newProject()])
  const removeProject = (id: string) => setProjects(p => p.filter(proj => proj.id !== id))

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/persona/${personaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills,
          projects: projects.filter(p => p.title.trim()),
          rawVoice,
        }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setError('保存に失敗しました。もう一度お試しください。')
        setSaving(false)
      }
    } catch {
      setError('通信エラーが発生しました。')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F3FA' }}>
        <div className="w-8 h-8 border-4 rounded-full spin"
          style={{ borderColor: '#E8E6F5', borderTopColor: '#6366F1' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F3FA' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'white', borderBottom: '1px solid #E8E6F5' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#F4F3FA', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="font-black text-base" style={{ color: '#1E1B4B' }}>AIの知識を強化する</h1>
            <p className="text-xs" style={{ color: '#9896B8' }}>スキル・案件事例を学習させると回答精度が上がります</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* 生の声 ← 最も重要なセクション */}
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))', border: '1.5px solid rgba(99,102,241,0.25)' }}>
          <div className="flex items-start gap-3 mb-3">
            <span style={{ fontSize: 24, flexShrink: 0 }}>🎤</span>
            <div>
              <h2 className="font-black text-sm" style={{ color: '#1E1B4B' }}>
                あなたの生の言葉を貼り付ける
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1' }}>最も効果大</span>
              </h2>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>
                SNS投稿・メール・ブログ・仕事への想いなど、<strong style={{ color: '#1E1B4B' }}>あなたが実際に書いた文章</strong>をそのまま貼り付けてください。<br />
                整えなくていいです。文体・語彙・熱量をAIが直接学習します。
              </p>
            </div>
          </div>
          <textarea
            value={rawVoice}
            onChange={e => setRawVoice(e.target.value)}
            rows={8}
            placeholder={`例：\n「正直、数字だけ追いかける仕事が好きじゃなくて。お客さんが「あ、なんか変わった気がする」って言ってくれた瞬間が一番うれしいんですよね。\n\n成果を出すことは当たり前だけど、それよりその人の事業が面白くなるかどうかを一番気にしてます。小手先の施策じゃなくて、なぜこれをやるのか、の部分から一緒に考えたい。」\n\n→ あなたが実際に書いた・話した文章をそのままどうぞ`}
            style={{
              width: '100%', padding: '14px', fontSize: 13, lineHeight: 1.7,
              border: '1.5px solid rgba(99,102,241,0.2)', borderRadius: 12,
              background: 'white', color: '#1E1B4B', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.2)'; e.target.style.boxShadow = 'none' }}
          />
          {rawVoice.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#9896B8' }}>{rawVoice.length}文字 · 多いほど精度が上がります</p>
          )}
        </div>

        {/* スキルセット */}
        <div className="card p-5">
          <h2 className="font-black text-sm mb-1" style={{ color: '#1E1B4B' }}>
            スキルセット・専門領域
          </h2>
          <p className="text-xs mb-3" style={{ color: '#9896B8' }}>
            技術・手法・得意分野などを入力。Enterで追加（最大20個）
          </p>
          <div
            className="flex flex-wrap gap-2 p-2.5 rounded-xl"
            style={{ background: '#F4F3FA', border: '1.5px solid #D1D0E8', minHeight: 50 }}
          >
            {skills.map(sk => (
              <span key={sk}
                className="flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full"
                style={{ background: '#EEF2FF', color: '#4338CA' }}
              >
                {sk}
                <button
                  onClick={() => setSkills(p => p.filter(s => s !== sk))}
                  style={{ color: '#818CF8', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >×</button>
              </span>
            ))}
            {skills.length < 20 && (
              <input
                type="text" value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={handleKwKey}
                onBlur={() => kwInput && addSkill(kwInput)}
                placeholder={skills.length === 0 ? 'React, TypeScript, BtoB営業... など' : '追加...'}
                className="outline-none bg-transparent text-sm flex-1"
                style={{ minWidth: 140, color: '#1E1B4B' }}
              />
            )}
          </div>
          {skills.length > 0 && (
            <p className="text-xs mt-2" style={{ color: '#9896B8' }}>{skills.length}個登録済み</p>
          )}
        </div>

        {/* 過去案件 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-black text-sm" style={{ color: '#1E1B4B' }}>過去案件・プロジェクト事例</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9896B8' }}>具体的な数字・結果まで書くほど精度が上がります</p>
            </div>
            <button
              onClick={addProject}
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 10,
                background: '#EEF2FF', color: '#4338CA', border: '1.5px solid #C7D2FE',
                cursor: 'pointer',
              }}
            >
              + 追加
            </button>
          </div>

          <div className="space-y-4">
            {projects.map((proj, idx) => (
              <div key={proj.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black" style={{ color: '#6366F1' }}>案件 {idx + 1}</span>
                  {projects.length > 1 && (
                    <button
                      onClick={() => removeProject(proj.id)}
                      style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                    >
                      削除
                    </button>
                  )}
                </div>
                {[
                  { field: 'title',     label: 'プロジェクト名・タイトル', placeholder: '○○社のWebマーケティング改善支援', required: true },
                  { field: 'challenge', label: '課題・背景',               placeholder: '月間CV数が停滞しており、広告効率が悪化していた' },
                  { field: 'approach',  label: 'アプローチ・手法',         placeholder: 'LP改善とリターゲティング広告の最適化を実施' },
                  { field: 'result',    label: '結果（数字を含めると◎）',  placeholder: '3ヶ月でCV数1.8倍、CPA30%改善' },
                  { field: 'tech',      label: '使用技術・ツール（任意）', placeholder: 'Google Ads, GA4, Figma' },
                ].map(({ field, label, placeholder, required }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#4A4870' }}>
                      {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
                    </label>
                    <input
                      type="text"
                      value={proj[field as keyof Project]}
                      onChange={e => updateProject(proj.id, field as keyof Project, e.target.value)}
                      placeholder={placeholder}
                      style={{
                        width: '100%', padding: '9px 12px', fontSize: 13,
                        border: '1.5px solid #D1D0E8', borderRadius: 8,
                        background: '#F4F3FA', color: '#1E1B4B', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = '#D1D0E8'; e.target.style.background = '#F4F3FA'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: '#EF4444' }}>{error}</p>
        )}

        {/* 保存ボタン */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              flex: 1, padding: '13px', fontSize: 14, fontWeight: 600,
              background: '#F4F3FA', color: '#6B7280',
              border: '1.5px solid #D1D0E8', borderRadius: 12, cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '13px', fontSize: 15, fontWeight: 700,
              background: saving ? '#D1D0E8' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: saving ? '#9896B8' : 'white',
              border: 'none', borderRadius: 12,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 14px rgba(99,102,241,0.3)',
            }}
          >
            {saving ? '保存中...' : 'AIに学習させる →'}
          </button>
        </div>
      </div>
    </div>
  )
}
