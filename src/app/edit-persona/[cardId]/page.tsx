'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, KeyboardEvent } from 'react'

const SKILL_PRESETS = [
  { category: '営業', items: ['BtoB営業', 'BtoC営業', '法人営業', '新規開拓', 'インサイドセールス', 'カスタマーサクセス', '代理店営業'] },
  { category: 'マーケ・集客', items: ['SNS運用', 'Web広告', 'SEO', 'コンテンツマーケ', 'メールマーケ', 'ブランディング', 'PR・広報'] },
  { category: 'IT・開発', items: ['Web開発', 'React', 'TypeScript', 'Python', 'AWS', 'アプリ開発', 'UI/UX設計', 'Figma', 'AI/機械学習'] },
  { category: '経営・戦略', items: ['経営企画', '事業開発', '新規事業', 'PMO', 'スタートアップ', 'コンサルティング', '資金調達', 'M&A'] },
  { category: 'クリエイティブ', items: ['Webデザイン', 'グラフィックデザイン', '動画制作', 'ライティング', '写真撮影', '映像編集'] },
  { category: '人材・組織', items: ['採用・HR', '研修・育成', 'コーチング', '組織開発', 'キャリア支援'] },
  { category: '財務・法務', items: ['財務・会計', '税務', '法務・契約', 'IPO支援'] },
]
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TONE_PRESETS, TonePresetId, buildToneProfile, parseToneProfile } from '@/lib/tone-presets'

interface Project {
  id: string
  title: string
  challenge: string
  approach: string
  result: string
  tech: string
}

interface FaqItem {
  id: string
  question: string
  answer: string
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
  const [tonePreset, setTonePreset] = useState<TonePresetId | 'custom'>('natural')
  const [toneCustom, setToneCustom] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [projects, setProjects] = useState<Project[]>([newProject()])
  const [faqs, setFaqs] = useState<FaqItem[]>([])
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

      const persona = card.personas as { values_summary?: string; tone_profile?: string; achievements_json?: Array<{ title: string; description: string }> }
      // tone_profile の読み込み
      if (persona?.tone_profile !== undefined) {
        const { presetId, custom } = parseToneProfile(persona.tone_profile ?? null)
        setTonePreset(presetId)
        setToneCustom(custom)
      }
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

      // 既存FAQの読み込み
      const p = card.personas as { values_summary?: string; achievements_json?: Array<{ title: string; description: string }>; faq_json?: Array<{ question: string; answer: string }> }
      if (p?.faq_json?.length) {
        setFaqs(p.faq_json.map(f => ({ id: crypto.randomUUID(), question: f.question, answer: f.answer })))
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

  const addFaq = () => setFaqs(p => [...p, { id: crypto.randomUUID(), question: '', answer: '' }])
  const removeFaq = (id: string) => setFaqs(p => p.filter(f => f.id !== id))
  const updateFaq = (id: string, field: 'question' | 'answer', val: string) =>
    setFaqs(p => p.map(f => f.id === id ? { ...f, [field]: val } : f))

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
          faqs: faqs.filter(f => f.question.trim()),
          toneProfile: buildToneProfile(tonePreset, toneCustom),
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF5F0' }}>
        <div className="w-8 h-8 border-4 rounded-full spin"
          style={{ borderColor: '#EDD9C8', borderTopColor: '#F26722' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF5F0' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'white', borderBottom: '1px solid #EDD9C8' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#FAF5F0', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="font-black text-base" style={{ color: '#1C0F05' }}>AIの知識を強化する</h1>
            <p className="text-xs" style={{ color: '#A08068' }}>スキル・案件事例を学習させると回答精度が上がります</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── 口調・トーン設定 ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 20 }}>🎭</span>
            <h2 className="font-black text-sm" style={{ color: '#1C0F05' }}>AIの口調・トーン</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: '#A08068' }}>
            お客様に対してどんな話し方をするか選んでください。業種・ブランドイメージに合わせてください
          </p>

          {/* プリセット選択 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {TONE_PRESETS.map(preset => {
              const selected = tonePreset === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => setTonePreset(preset.id)}
                  style={{
                    padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                    border: selected ? '2px solid #F26722' : '1.5px solid #DEC4AD',
                    background: selected ? 'rgba(242,103,34,0.06)' : 'white',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{preset.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: selected ? '#C4511A' : '#1C0F05', marginBottom: 2 }}>
                    {preset.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#A08068', lineHeight: 1.4 }}>{preset.desc}</div>
                </button>
              )
            })}
            {/* カスタム */}
            <button
              onClick={() => setTonePreset('custom')}
              style={{
                padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                border: tonePreset === 'custom' ? '2px solid #F26722' : '1.5px solid #DEC4AD',
                background: tonePreset === 'custom' ? 'rgba(242,103,34,0.06)' : 'white',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>✍️</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: tonePreset === 'custom' ? '#C4511A' : '#1C0F05', marginBottom: 2 }}>
                カスタム
              </div>
              <div style={{ fontSize: 11, color: '#A08068', lineHeight: 1.4 }}>自分で細かく指定</div>
            </button>
          </div>

          {/* 選択中プリセットのプレビュー */}
          {tonePreset !== 'custom' && (() => {
            const p = TONE_PRESETS.find(p => p.id === tonePreset)
            return p ? (
              <div style={{ background: '#FAF5F0', border: '1px solid #EDD9C8', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#A08068' }}>AIへの指示（プリセット内容）</p>
                <p className="text-xs" style={{ color: '#4A2C1A', lineHeight: 1.6 }}>{p.value}</p>
              </div>
            ) : null
          })()}

          {/* 追加指示 or カスタム全文 */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A2C1A' }}>
              {tonePreset === 'custom' ? '口調の指示（自由記述）' : '追加の口調指示（任意）'}
            </label>
            <textarea
              value={toneCustom}
              onChange={e => setToneCustom(e.target.value)}
              rows={tonePreset === 'custom' ? 4 : 2}
              placeholder={
                tonePreset === 'custom'
                  ? '例：語尾は「〜ですよ」「〜ですね」を使う。関西弁で話す。文章は短く句点で区切る。'
                  : '例：「〜でございます」をより多く使う。文末は必ず句点で終える。'
              }
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13, lineHeight: 1.7,
                border: '1.5px solid #DEC4AD', borderRadius: 10,
                background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {/* 生の声 ← 最も重要なセクション */}
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(242,103,34,0.06), rgba(242,103,34,0.1))', border: '1.5px solid rgba(242,103,34,0.25)' }}>
          <div className="flex items-start gap-3 mb-3">
            <span style={{ fontSize: 24, flexShrink: 0 }}>🎤</span>
            <div>
              <h2 className="font-black text-sm" style={{ color: '#1C0F05' }}>
                あなたの生の言葉を貼り付ける
                <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(242,103,34,0.12)', color: '#F26722' }}>最も効果大</span>
              </h2>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>
                SNS投稿・メール・ブログ・仕事への想いなど、<strong style={{ color: '#1C0F05' }}>あなたが実際に書いた文章</strong>をそのまま貼り付けてください。<br />
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
              border: '1.5px solid rgba(242,103,34,0.2)', borderRadius: 12,
              background: 'white', color: '#1C0F05', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.1)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(242,103,34,0.2)'; e.target.style.boxShadow = 'none' }}
          />
          <div className="mt-2 flex items-center justify-between">
            {rawVoice.length > 0 ? (
              <div className="flex items-center gap-2">
                <div className="text-xs font-bold" style={{ color: rawVoice.length >= 300 ? '#059669' : rawVoice.length >= 100 ? '#F59E0B' : '#EF4444' }}>
                  {rawVoice.length >= 300 ? '✓ 精度：高' : rawVoice.length >= 100 ? '△ 精度：中（もう少し書くと上がります）' : '✗ 精度：低（100文字以上を目安に）'}
                </div>
                <span className="text-xs" style={{ color: '#A08068' }}>{rawVoice.length}文字</span>
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#A08068' }}>100文字以上書くと効果が出ます（300文字以上で最高精度）</p>
            )}
          </div>
          {rawVoice.length > 0 && rawVoice.length < 100 && (
            <div className="mt-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#B91C1C' }}>
              💡 ヒント：SNSの投稿、お客様へのメール、自己紹介文など、すでに書いたものをそのまま貼り付けるだけでOKです
            </div>
          )}
        </div>

        {/* スキルセット */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-black text-sm" style={{ color: '#1C0F05' }}>スキルセット・専門領域</h2>
            <span className="text-xs font-bold" style={{ color: skills.length >= 20 ? '#EF4444' : '#A08068' }}>
              {skills.length}/20
            </span>
          </div>
          <p className="text-xs mb-4" style={{ color: '#A08068' }}>
            タップで追加・解除。一覧にないものは下の入力欄から追加できます
          </p>

          {/* プリセット選択肢 */}
          <div className="space-y-3 mb-4">
            {SKILL_PRESETS.map(group => (
              <div key={group.category}>
                <p className="text-xs font-black mb-1.5" style={{ color: '#A08068', letterSpacing: '0.06em' }}>
                  {group.category}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(item => {
                    const selected = skills.includes(item)
                    return (
                      <button
                        key={item}
                        onClick={() => {
                          if (selected) {
                            setSkills(p => p.filter(s => s !== item))
                          } else if (skills.length < 20) {
                            setSkills(p => [...p, item])
                          }
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: selected ? '#F26722' : 'white',
                          color: selected ? 'white' : '#4A2C1A',
                          border: `1.5px solid ${selected ? 'transparent' : '#DEC4AD'}`,
                          cursor: skills.length >= 20 && !selected ? 'not-allowed' : 'pointer',
                          opacity: skills.length >= 20 && !selected ? 0.4 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {selected ? `✓ ${item}` : item}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 自由入力（一覧にないスキル用） */}
          {skills.length < 20 && (
            <div style={{ borderTop: '1px solid #EDD9C8', paddingTop: 12 }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#A08068' }}>一覧にないスキルを追加</p>
              <div className="flex gap-2">
                <input
                  type="text" value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={handleKwKey}
                  onBlur={() => kwInput && addSkill(kwInput)}
                  placeholder="例: 補助金申請, 中国語, ..."
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8,
                    border: '1.5px solid #DEC4AD', background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff' }}
                  onBlurCapture={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0' }}
                />
                <button
                  onClick={() => addSkill(kwInput)}
                  disabled={!kwInput.trim()}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: kwInput.trim() ? '#F26722' : '#EDD9C8',
                    color: kwInput.trim() ? 'white' : '#A08068',
                    border: 'none', cursor: kwInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  追加
                </button>
              </div>
            </div>
          )}

          {/* 追加済みカスタムスキル（プリセット外のもの） */}
          {skills.filter(s => !SKILL_PRESETS.flatMap(g => g.items).includes(s)).length > 0 && (
            <div style={{ borderTop: '1px solid #EDD9C8', paddingTop: 10, marginTop: 10 }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#A08068' }}>カスタム追加済み</p>
              <div className="flex flex-wrap gap-1.5">
                {skills.filter(s => !SKILL_PRESETS.flatMap(g => g.items).includes(s)).map(sk => (
                  <span key={sk}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: '#1C0F05', color: 'white' }}
                  >
                    {sk}
                    <button
                      onClick={() => setSkills(p => p.filter(s => s !== sk))}
                      style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* よくある質問 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-black text-sm" style={{ color: '#1C0F05' }}>お問い合わせ対応設定</h2>
              <p className="text-xs mt-0.5" style={{ color: '#A08068' }}>よくある質問と回答を登録しておくとAIが代わりに答えます</p>
            </div>
            <button
              onClick={addFaq}
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 10,
                background: '#FFF0E8', color: '#C4511A', border: '1.5px solid #FDD5B5', cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >＋ 追加</button>
          </div>
          <div className="space-y-3">
            {faqs.length === 0 && (
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.5)', border: '1.5px dashed #DEC4AD' }}>
                <p className="text-sm" style={{ color: '#A08068' }}>＋ 追加ボタンでFAQを登録できます</p>
              </div>
            )}
            {faqs.map((faq, idx) => (
              <div key={faq.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black" style={{ color: '#F26722' }}>FAQ {idx + 1}</span>
                  <button
                    onClick={() => removeFaq(faq.id)}
                    style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >削除</button>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#4A2C1A' }}>
                    質問 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <textarea
                    value={faq.question}
                    onChange={e => updateFaq(faq.id, 'question', e.target.value)}
                    placeholder="例：料金はどのくらいですか？"
                    rows={2}
                    style={{
                      width: '100%', padding: '9px 12px', fontSize: 13, lineHeight: 1.6,
                      border: '1.5px solid #DEC4AD', borderRadius: 8,
                      background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                      boxSizing: 'border-box', resize: 'none',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#4A2C1A' }}>回答</label>
                  <textarea
                    value={faq.answer}
                    onChange={e => updateFaq(faq.id, 'answer', e.target.value)}
                    rows={3}
                    placeholder="例：プロジェクト規模によりますが、月10〜30万円が目安です。まずはご相談ください。"
                    style={{
                      width: '100%', padding: '9px 12px', fontSize: 13, lineHeight: 1.6,
                      border: '1.5px solid #DEC4AD', borderRadius: 8,
                      background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                      resize: 'vertical', boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 過去案件 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-black text-sm" style={{ color: '#1C0F05' }}>過去案件・プロジェクト事例</h2>
              <p className="text-xs mt-0.5" style={{ color: '#A08068' }}>具体的な数字・結果まで書くほど精度が上がります</p>
            </div>
            <button
              onClick={addProject}
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 10,
                background: '#FFF0E8', color: '#C4511A', border: '1.5px solid #FDD5B5',
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
                  <span className="text-xs font-black" style={{ color: '#F26722' }}>案件 {idx + 1}</span>
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
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#4A2C1A' }}>
                      {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
                    </label>
                    <input
                      type="text"
                      value={proj[field as keyof Project]}
                      onChange={e => updateProject(proj.id, field as keyof Project, e.target.value)}
                      placeholder={placeholder}
                      style={{
                        width: '100%', padding: '9px 12px', fontSize: 13,
                        border: '1.5px solid #DEC4AD', borderRadius: 8,
                        background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
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
              background: '#FAF5F0', color: '#6B7280',
              border: '1.5px solid #DEC4AD', borderRadius: 12, cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '13px', fontSize: 15, fontWeight: 700,
              background: saving ? '#DEC4AD' : 'linear-gradient(135deg, #F26722, #F59340)',
              color: saving ? '#A08068' : 'white',
              border: 'none', borderRadius: 12,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 14px rgba(242,103,34,0.3)',
            }}
          >
            {saving ? '保存中...' : 'AIに学習させる →'}
          </button>
        </div>
      </div>
    </div>
  )
}
