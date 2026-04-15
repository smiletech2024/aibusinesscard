'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CardData {
  full_name: string; title: string; company: string
  short_intro: string; email: string; phone: string; website: string
}
interface ToneOption { id: string; label: string; profile: string }
interface ValueOption { id: string; text: string }
interface FaqItem { id: string; question: string; answer: string }
interface DraftData {
  tones: ToneOption[]
  values: ValueOption[]
  faqs: FaqItem[]
  forbidden: string[]
}
type Step = 'quick' | 'generating' | 'select' | 'card' | 'saving' | 'done'

const cardFields = [
  { key: 'full_name',   label: '氏名',     placeholder: '山田 太郎',                  required: true },
  { key: 'title',       label: '肩書き',   placeholder: 'マーケティングコンサルタント', required: false },
  { key: 'company',     label: '会社名',   placeholder: '株式会社 Example',            required: false },
  { key: 'short_intro', label: '一言紹介', placeholder: 'ROI改善が得意なWebマーケター', required: false },
  { key: 'email',       label: 'メール',   placeholder: 'you@example.com',             required: false },
  { key: 'phone',       label: '電話番号', placeholder: '090-xxxx-xxxx',               required: false },
  { key: 'website',     label: 'Web',      placeholder: 'https://yoursite.com',        required: false },
]

const INDUSTRIES = [
  'マーケティング・広告', 'IT・SaaS・開発', 'コンサルティング', '営業・BizDev',
  '人材・採用', 'デザイン・クリエイティブ', '会計・税務・法務', '不動産',
  '医療・ヘルスケア', '教育・コーチング', '製造・建設', 'その他',
]

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('quick')

  // Quick form
  const [qName, setQName] = useState('')
  const [qTitle, setQTitle] = useState('')
  const [qIndustry, setQIndustry] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')

  // Draft & selections
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [selToneId, setSelToneId] = useState('')
  const [selValueId, setSelValueId] = useState('')
  const [selFaqIds, setSelFaqIds] = useState<Set<string>>(new Set())

  // Card
  const [cardData, setCardData] = useState<CardData>({
    full_name: '', title: '', company: '', short_intro: '', email: '', phone: '', website: '',
  })

  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login')
    })
  }, [])

  useEffect(() => {
    if (step !== 'generating') { setElapsedSeconds(0); return }
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [step])

  /* ── キーワードタグ操作 ── */
  const addKeyword = (kw: string) => {
    const t = kw.replace(/,/g, '').trim()
    if (t && !keywords.includes(t) && keywords.length < 6) setKeywords(p => [...p, t])
    setKwInput('')
  }
  const handleKwKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(kwInput) }
    else if (e.key === 'Backspace' && !kwInput && keywords.length > 0) setKeywords(p => p.slice(0, -1))
  }

  /* ── ドラフト生成 ── */
  const generateDraft = async () => {
    if (!qName || !qTitle || !qIndustry || keywords.length === 0) return
    setStep('generating')
    try {
      const res = await fetch('/api/generate-persona-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: qName, title: qTitle, industry: qIndustry, keywords }),
      })
      const data = await res.json()
      if (data.draft) {
        setDraft(data.draft)
        setSelToneId(data.draft.tones?.[0]?.id ?? '')
        setSelValueId(data.draft.values?.[0]?.id ?? '')
        setSelFaqIds(new Set(data.draft.faqs?.map((f: FaqItem) => f.id) ?? []))
        setCardData(p => ({ ...p, full_name: qName, title: qTitle }))
        setStep('select')
      } else {
        setStep('quick')
      }
    } catch { setStep('quick') }
  }

  /* ── 保存 ── */
  const savePersona = async () => {
    if (!cardData.full_name || !draft) return
    setStep('saving')
    const tone = draft.tones.find(t => t.id === selToneId)
    const value = draft.values.find(v => v.id === selValueId)
    const faqs = draft.faqs.filter(f => selFaqIds.has(f.id)).map(f => ({ question: f.question, answer: f.answer }))
    try {
      const res = await fetch('/api/persona', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardData,
          draftSelections: {
            tone: tone?.profile ?? '',
            values: value?.text ?? '',
            faqs,
            forbidden: draft.forbidden ?? [],
          },
        }),
      })
      const data = await res.json()
      if (data.personaId) { setStep('done') }
      else setStep('select')
    } catch { setStep('select') }
  }

  /* ════════════════════════════════
     STEP: quick
  ════════════════════════════════ */
  if (step === 'quick') {
    const canGenerate = qName && qTitle && qIndustry && keywords.length > 0
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#F4F3FA' }}>
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EEF2FF' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black mb-1" style={{ color: '#1E1B4B' }}>あなたを教えてください</h1>
            <p className="text-sm" style={{ color: '#9896B8' }}>30秒で入力 → AIが分身を自動生成します</p>
          </div>

          <div className="card p-6 space-y-5">
            {/* 氏名 */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#4A4870' }}>
                氏名 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text" value={qName} onChange={e => setQName(e.target.value)}
                placeholder="山田 太郎"
                style={inputStyle}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            {/* 肩書き */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#4A4870' }}>
                肩書き・職種 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text" value={qTitle} onChange={e => setQTitle(e.target.value)}
                placeholder="マーケティングコンサルタント"
                style={inputStyle}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            {/* 業種 */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#4A4870' }}>
                業種・分野 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind}
                    onClick={() => setQIndustry(ind)}
                    style={{
                      padding: '6px 14px', fontSize: 13, borderRadius: 20, cursor: 'pointer',
                      fontWeight: qIndustry === ind ? 700 : 500,
                      background: qIndustry === ind ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#F4F3FA',
                      color: qIndustry === ind ? 'white' : '#4A4870',
                      border: qIndustry === ind ? 'none' : '1.5px solid #D1D0E8',
                      transition: 'all 0.15s',
                    }}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* キーワード */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#4A4870' }}>
                得意分野・キーワード <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <p className="text-xs mb-2" style={{ color: '#9896B8' }}>Enterで追加（最大6個）例：SNS運用、BtoB、スタートアップ支援</p>
              <div
                className="flex flex-wrap gap-2 p-2 rounded-xl"
                style={{ background: '#F4F3FA', border: '1.5px solid #D1D0E8', minHeight: 46 }}
              >
                {keywords.map(kw => (
                  <span
                    key={kw}
                    className="flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full"
                    style={{ background: '#EEF2FF', color: '#4338CA' }}
                  >
                    {kw}
                    <button onClick={() => setKeywords(p => p.filter(k => k !== kw))} style={{ color: '#818CF8', fontWeight: 700, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                  </span>
                ))}
                {keywords.length < 6 && (
                  <input
                    type="text" value={kwInput}
                    onChange={e => setKwInput(e.target.value)}
                    onKeyDown={handleKwKey}
                    onBlur={() => kwInput && addKeyword(kwInput)}
                    placeholder={keywords.length === 0 ? 'キーワードを入力してEnter' : '追加...'}
                    className="outline-none bg-transparent text-sm flex-1"
                    style={{ minWidth: 120, color: '#1E1B4B' }}
                  />
                )}
              </div>
            </div>

            <button
              onClick={generateDraft}
              disabled={!canGenerate}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
                background: canGenerate ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#D1D0E8',
                color: canGenerate ? 'white' : '#9896B8',
                border: 'none', borderRadius: 12, cursor: canGenerate ? 'pointer' : 'not-allowed',
                boxShadow: canGenerate ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
                marginTop: 8, transition: 'all 0.2s',
              }}
            >
              AIに分身を生成させる →
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     STEP: generating
  ════════════════════════════════ */
  if (step === 'generating') {
    const TOTAL = 20
    const progress = Math.min((elapsedSeconds / TOTAL) * 100, 95)
    const genSteps = [
      { label: 'あなたの情報を分析中', at: 0 },
      { label: '話し方スタイルを設計中', at: 4 },
      { label: '価値観・強みを整理中', at: 9 },
      { label: 'よくある質問を生成中', at: 14 },
    ]
    const currentStep = [...genSteps].reverse().find(s => elapsedSeconds >= s.at)
    const isLong = elapsedSeconds >= 25

    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F4F3FA' }}>
        <div className="w-full max-w-sm">
          {/* アイコン */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <h2 className="font-black text-xl mb-1" style={{ color: '#1E1B4B' }}>分身を生成中...</h2>
            <p className="text-sm" style={{ color: '#9896B8' }}>
              {isLong ? 'AIサーバーが混雑しています。もう少しお待ちください' : 'このまましばらくお待ちください（約15〜20秒）'}
            </p>
          </div>

          {/* プログレスバー */}
          <div className="mb-6">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#9896B8' }}>
              <span>{currentStep?.label ?? '準備中'}...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8E6F5' }}>
              <div
                className="h-2 rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                }}
              />
            </div>
          </div>

          {/* ステップリスト */}
          <div className="card p-4 space-y-3">
            {genSteps.map((s, i) => {
              const done = elapsedSeconds > s.at + 4
              const active = elapsedSeconds >= s.at && !done
              return (
                <div key={i} className="flex items-center gap-3">
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? '#6366F1' : active ? 'rgba(99,102,241,0.15)' : '#F4F3FA',
                    border: active ? '2px solid #6366F1' : done ? 'none' : '2px solid #E8E6F5',
                    transition: 'all 0.4s',
                  }}>
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : active ? (
                      <div className="w-2 h-2 rounded-full spin" style={{ border: '2px solid transparent', borderTopColor: '#6366F1' }} />
                    ) : null}
                  </div>
                  <span className="text-sm" style={{
                    color: done ? '#1E1B4B' : active ? '#6366F1' : '#C4C2D8',
                    fontWeight: done || active ? 600 : 400,
                    transition: 'all 0.3s',
                  }}>
                    {s.label}
                    {done && <span style={{ color: '#34D399', marginLeft: 6, fontSize: 12 }}>✓</span>}
                  </span>
                </div>
              )
            })}
          </div>

          {isLong && (
            <p className="text-xs text-center mt-4" style={{ color: '#9896B8' }}>
              {elapsedSeconds}秒経過 · 通常15〜20秒で完成します
            </p>
          )}
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     STEP: select
  ════════════════════════════════ */
  if (step === 'select' && draft) {
    const toggleFaq = (id: string) => setSelFaqIds(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
    const updateTone = (id: string, profile: string) =>
      setDraft(d => d ? { ...d, tones: d.tones.map(t => t.id === id ? { ...t, profile } : t) } : d)
    const updateValue = (id: string, text: string) =>
      setDraft(d => d ? { ...d, values: d.values.map(v => v.id === id ? { ...v, text } : v) } : d)
    const updateFaq = (id: string, field: 'question' | 'answer', val: string) =>
      setDraft(d => d ? { ...d, faqs: d.faqs.map(f => f.id === id ? { ...f, [field]: val } : f) } : d)

    const editAreaStyle: React.CSSProperties = {
      width: '100%', padding: '10px 12px', fontSize: 14, lineHeight: 1.7,
      border: '2px solid #818CF8', borderRadius: 10,
      background: 'white', color: '#1E1B4B', outline: 'none',
      resize: 'vertical', boxSizing: 'border-box', marginTop: 8,
      boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
      touchAction: 'manipulation',
    }
    const editInputStyle: React.CSSProperties = {
      width: '100%', padding: '9px 12px', fontSize: 14, fontWeight: 600,
      border: '2px solid #818CF8', borderRadius: 10,
      background: 'white', color: '#1E1B4B', outline: 'none',
      boxSizing: 'border-box', marginBottom: 6,
      boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
      touchAction: 'manipulation',
    }

    return (
      <div className="min-h-screen" style={{ background: '#F4F3FA' }}>
        <div className="sticky top-0 z-10" style={{ background: 'linear-gradient(135deg, #4338CA, #6D28D9)', padding: '16px 16px 14px' }}>
          <div className="max-w-2xl mx-auto">
            <h1 className="font-black text-white text-base">あなたの分身を選んで確定</h1>
            <p className="text-white/60 text-xs mt-0.5">選んだ後、テキストをそのまま編集できます</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* ── 話し方スタイル ── */}
          <section>
            <h2 className="text-sm font-black mb-3 flex items-center gap-2" style={{ color: '#1E1B4B' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#6366F1' }}>1</span>
              話し方スタイル
            </h2>
            <div className="space-y-2.5">
              {draft.tones.map(tone => {
                const sel = selToneId === tone.id
                return (
                  <div key={tone.id} className="p-4 rounded-2xl transition-all"
                    style={{
                      background: sel ? 'white' : 'rgba(255,255,255,0.6)',
                      border: sel ? '2px solid #6366F1' : '2px solid transparent',
                      boxShadow: sel ? '0 4px 16px rgba(99,102,241,0.15)' : 'none',
                    }}>
                    {/* 選択行 — ここだけ onClick */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelToneId(tone.id)}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        border: sel ? '6px solid #6366F1' : '2px solid #D1D0E8',
                        background: 'white', transition: 'all 0.15s',
                      }} />
                      <p className="font-bold text-sm" style={{ color: sel ? '#4338CA' : '#1E1B4B' }}>{tone.label}</p>
                    </div>
                    {/* 説明 or 編集エリア — 選択行の兄弟要素 */}
                    {sel ? (
                      <div style={{ marginTop: 10, marginLeft: 32 }}>
                        <p className="text-xs font-bold mb-1" style={{ color: '#818CF8' }}>✏️ 内容を編集できます</p>
                        <textarea
                          value={tone.profile}
                          onChange={e => updateTone(tone.id, e.target.value)}
                          rows={3}
                          style={editAreaStyle}
                        />
                      </div>
                    ) : (
                      <p className="text-xs mt-1.5 leading-relaxed ml-8" style={{ color: '#9896B8' }}>{tone.profile}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── 価値観・強み ── */}
          <section>
            <h2 className="text-sm font-black mb-3 flex items-center gap-2" style={{ color: '#1E1B4B' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#6366F1' }}>2</span>
              価値観・強みの紹介文
            </h2>
            <div className="space-y-2.5">
              {draft.values.map(val => {
                const sel = selValueId === val.id
                return (
                  <div key={val.id} className="p-4 rounded-2xl transition-all"
                    style={{
                      background: sel ? 'white' : 'rgba(255,255,255,0.6)',
                      border: sel ? '2px solid #6366F1' : '2px solid transparent',
                      boxShadow: sel ? '0 4px 16px rgba(99,102,241,0.15)' : 'none',
                    }}>
                    {/* 選択行 — ここだけ onClick */}
                    <div className="flex items-start gap-3 cursor-pointer" onClick={() => setSelValueId(val.id)}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                        border: sel ? '6px solid #6366F1' : '2px solid #D1D0E8',
                        background: 'white', transition: 'all 0.15s',
                      }} />
                      <p className="text-sm leading-relaxed" style={{ color: sel ? '#4338CA' : '#6B7280' }}>
                        {sel ? '✓ 選択中 — 下のテキストを編集できます' : val.text}
                      </p>
                    </div>
                    {/* 編集エリア — 選択行の兄弟要素（親に onClick なし）*/}
                    {sel && (
                      <div style={{ marginTop: 10, marginLeft: 32 }}>
                        <p className="text-xs font-bold mb-1" style={{ color: '#818CF8' }}>✏️ 内容を編集できます</p>
                        <textarea
                          value={val.text}
                          onChange={e => updateValue(val.id, e.target.value)}
                          rows={4}
                          style={{ ...editAreaStyle, marginTop: 0 }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── よくある質問 ── */}
          <section>
            <h2 className="text-sm font-black mb-1 flex items-center gap-2" style={{ color: '#1E1B4B' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: '#6366F1' }}>3</span>
              よくある質問
            </h2>
            <p className="text-xs mb-3 ml-8" style={{ color: '#9896B8' }}>使うものをオンにして、内容も直接編集できます</p>
            <div className="space-y-2">
              {draft.faqs.map(faq => {
                const on = selFaqIds.has(faq.id)
                return (
                  <div key={faq.id} className="p-3.5 rounded-xl transition-all"
                    style={{
                      background: on ? 'white' : 'rgba(255,255,255,0.45)',
                      border: on ? '1.5px solid #C7D2FE' : '1.5px solid transparent',
                    }}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                          background: on ? '#6366F1' : 'white',
                          border: on ? 'none' : '2px solid #D1D0E8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s', cursor: 'pointer',
                        }}
                      >
                        {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </button>
                      <div className="flex-1 min-w-0">
                        {on ? (
                          <div>
                            <p className="text-xs font-bold mb-1.5" style={{ color: '#818CF8' }}>✏️ 質問・回答を編集できます</p>
                            <input
                              value={faq.question}
                              onChange={e => updateFaq(faq.id, 'question', e.target.value)}
                              style={editInputStyle}
                            />
                            <textarea
                              value={faq.answer}
                              onChange={e => updateFaq(faq.id, 'answer', e.target.value)}
                              rows={3}
                              style={editAreaStyle}
                            />
                          </div>
                        ) : (
                          <p className="text-sm font-semibold" style={{ color: '#9896B8' }}>{faq.question}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <button
            onClick={() => setStep('card')}
            disabled={!selToneId || !selValueId || selFaqIds.size === 0}
            style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: 'white', border: 'none', borderRadius: 14, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)', marginTop: 8,
            }}
          >
            この内容で名刺情報を入力する →
          </button>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     STEP: card
  ════════════════════════════════ */
  if (step === 'card') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#F4F3FA' }}>
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EEF2FF' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="3" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <h1 className="text-2xl font-black mb-1" style={{ color: '#1E1B4B' }}>名刺に載せる情報</h1>
            <p className="text-sm" style={{ color: '#9896B8' }}>QRコードから開いたとき、お客様が最初に見る情報です</p>
          </div>
          <div className="card p-6 space-y-4">
            {cardFields.map(({ key, label, placeholder, required }) => (
              <div key={key}>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#4A4870' }}>
                  {label}{required && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
                </label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={cardData[key as keyof CardData]}
                  onChange={e => setCardData(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>
            ))}
            <button
              onClick={savePersona}
              disabled={!cardData.full_name}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white', border: 'none', borderRadius: 12,
                cursor: cardData.full_name ? 'pointer' : 'not-allowed',
                opacity: cardData.full_name ? 1 : 0.5,
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)', marginTop: 8,
              }}
            >
              この内容で分身AIを完成させる →
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     STEP: saving
  ════════════════════════════════ */
  if (step === 'saving') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F3FA' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full spin mx-auto mb-5"
            style={{ border: '4px solid #E8E6F5', borderTopColor: '#6366F1' }} />
          <h2 className="font-black text-xl mb-2" style={{ color: '#1E1B4B' }}>あなたの分身を生成中...</h2>
          <p className="text-sm" style={{ color: '#9896B8' }}>選択した内容からAIを構築しています</p>
        </div>
      </div>
    )
  }

  /* ════════════════════════════════
     STEP: done
  ════════════════════════════════ */
  const journey = [
    { num: '1', title: 'QRコードを読む', desc: '名刺を渡した相手がここから始めます', color: '#6366F1' },
    { num: '2', title: 'AIがあなたの代わりに対応', desc: 'あなたの分身が24時間、何でも答えます', color: '#8B5CF6' },
    { num: '3', title: 'AIが会話を自動整理', desc: '相談内容・悩み・温度感をまとめます', color: '#A78BFA' },
    { num: '4', title: 'あなたに話しかける', desc: 'ここでダッシュボードに通知が届きます', color: '#059669' },
  ]
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#F4F3FA' }}>
      <div className="w-full max-w-lg fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: '#EEF2FF' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="font-black text-2xl mb-2" style={{ color: '#1E1B4B' }}>あなたの分身AIが生まれました</h2>
          <p className="text-sm" style={{ color: '#9896B8' }}>今この瞬間から、24時間働き始めます</p>
        </div>
        <div className="card p-6 mb-5">
          <p className="text-xs font-bold mb-4 uppercase tracking-widest" style={{ color: '#9896B8' }}>お客様はこう使います</p>
          <div className="space-y-4">
            {journey.map(({ num, title, desc, color }, i) => (
              <div key={num} className="flex items-start gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white" style={{ background: color }}>{num}</div>
                  {i < journey.length - 1 && <div style={{ width: 2, height: 24, background: '#E8E6F5', marginTop: 4 }} />}
                </div>
                <div style={{ paddingTop: 2 }}>
                  <p className="text-sm font-bold" style={{ color: '#1E1B4B' }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9896B8' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
          }}
        >
          ダッシュボードへ →
        </button>
      </div>
    </div>
  )
}

/* ── スタイルユーティリティ ── */
const inputStyle: React.CSSProperties = {
  padding: '11px 14px', fontSize: 14,
  border: '1.5px solid #D1D0E8', borderRadius: 10,
  background: '#F4F3FA', color: '#1E1B4B', outline: 'none',
}
const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = '#6366F1'
  e.target.style.background = '#fff'
  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
}
const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = '#D1D0E8'
  e.target.style.background = '#F4F3FA'
  e.target.style.boxShadow = 'none'
}
