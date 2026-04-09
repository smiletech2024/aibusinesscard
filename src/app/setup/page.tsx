'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Message { role: 'user' | 'assistant'; content: string }
interface CardData {
  full_name: string; title: string; company: string
  short_intro: string; email: string; phone: string; website: string
}
type Step = 'hearing' | 'card' | 'saving' | 'done'

const cardFields = [
  { key: 'full_name',   label: '氏名',     placeholder: '山田 太郎',                  required: true },
  { key: 'title',       label: '肩書き',   placeholder: 'マーケティングコンサルタント', required: false },
  { key: 'company',     label: '会社名',   placeholder: '株式会社 Example',            required: false },
  { key: 'short_intro', label: '一言紹介', placeholder: 'ROI改善が得意なWebマーケター', required: false },
  { key: 'email',       label: 'メール',   placeholder: 'you@example.com',             required: false },
  { key: 'phone',       label: '電話番号', placeholder: '090-xxxx-xxxx',               required: false },
  { key: 'website',     label: 'Web',      placeholder: 'https://yoursite.com',        required: false },
]

export default function SetupPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('hearing')
  const [cardData, setCardData] = useState<CardData>({
    full_name: '', title: '', company: '', short_intro: '', email: '', phone: '', website: '',
  })
  const [turnCount, setTurnCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login')
    })
    startHearing()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const readStream = async (res: Response): Promise<string> => {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    return text
  }

  const startHearing = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hearing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      })
      const text = await readStream(res)
      setMessages([{ role: 'assistant', content: text }])
    } finally { setLoading(false) }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setLoading(true)
    setTurnCount(prev => prev + 1)

    try {
      const res = await fetch('/api/hearing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      let aiText = ''
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      const updated: Message[] = [...newMessages, { role: 'assistant', content: '' }]
      setMessages(updated)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiText += decoder.decode(value)
        setMessages(prev => {
          const arr = [...prev]
          arr[arr.length - 1] = { role: 'assistant', content: aiText }
          return arr
        })
      }
      if (turnCount >= 9 || aiText.includes('分身AIを作成できます')) {
        setTimeout(() => setStep('card'), 1500)
      }
    } finally { setLoading(false) }
  }

  const savePersona = async () => {
    if (!cardData.full_name) return
    setStep('saving')
    try {
      const res = await fetch('/api/persona', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversations: messages, cardData }),
      })
      const data = await res.json()
      if (data.personaId) {
        setStep('done')
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch { setStep('card') }
  }

  const progress = Math.min((turnCount / 12) * 100, 100)

  /* ─── 名刺入力ステップ ─── */
  if (step === 'card') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "#F4F3FA" }}>
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#EEF2FF" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="3" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <h1 className="text-2xl font-black mb-1" style={{ color: "#1E1B4B" }}>名刺情報を入力</h1>
            <p className="text-sm" style={{ color: "#9896B8" }}>QRコードに表示される情報です</p>
          </div>

          <div className="card p-6 space-y-4">
            {cardFields.map(({ key, label, placeholder, required }) => (
              <div key={key}>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#4A4870" }}>
                  {label}{required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={cardData[key as keyof CardData]}
                  onChange={e => setCardData(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 14,
                    border: '1.5px solid #D1D0E8', borderRadius: 10,
                    background: '#F4F3FA', color: '#1E1B4B', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#D1D0E8'; e.target.style.background = '#F4F3FA'; e.target.style.boxShadow = 'none' }}
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
              分身AIを作成する →
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'saving') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F3FA" }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full spin mx-auto mb-5"
            style={{ border: '4px solid var(--border)', borderTopColor: 'var(--primary)' }} />
          <h2 className="font-black text-xl mb-2" style={{ color: "#1E1B4B" }}>分身AIを作成中...</h2>
          <p className="text-sm" style={{ color: "#9896B8" }}>あなたの思考をAIに学習させています</p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F3FA" }}>
        <div className="text-center fade-in">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "#EEF2FF" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="font-black text-2xl mb-2" style={{ color: "#1E1B4B" }}>分身AI完成！</h2>
          <p className="text-sm" style={{ color: "#9896B8" }}>ダッシュボードへ移動します...</p>
        </div>
      </div>
    )
  }

  /* ─── ヒアリングチャット ─── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F4F3FA" }}>
      {/* ヘッダー */}
      <div className="sticky top-0 z-10" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(30,27,75,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div>
              <h1 className="font-black text-white text-sm leading-tight">ヒアリングAI</h1>
              <p className="text-white/60 text-xs">分身AIを作成中 — 約10〜15問</p>
            </div>
            {turnCount >= 8 && (
              <button onClick={() => setStep('card')}
                className="ml-auto text-xs font-bold px-3 py-1.5 rounded-full text-white transition" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                完了して名刺作成へ →
              </button>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="h-1 rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'rgba(255,255,255,0.7)' }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-white/40">0</span>
            <span className="text-xs text-white/60 font-medium">{turnCount} / 12</span>
            <span className="text-xs text-white/40">12</span>
          </div>
        </div>
      </div>

      {/* メッセージ */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: 'var(--grad-primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
            )}
            <div className={`max-w-xs sm:max-w-md ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}
              style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && messages.length === 0 && (
          <div className="flex gap-3 justify-start fade-in">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--grad-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div className="bubble-ai flex items-center gap-1.5 px-5 py-3.5">
              <span className="dot-pulse"></span>
              <span className="dot-pulse"></span>
              <span className="dot-pulse"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="px-4 pb-6 pt-3 max-w-2xl mx-auto w-full">
        <div className="flex gap-2 p-2 rounded-2xl shadow-md" style={{ background: "#fff", border: "1.5px solid #E8E6F5" }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            placeholder="メッセージを入力..."
            className="flex-1 bg-transparent outline-none px-3 text-sm"
            style={{ color: "#1E1B4B" }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{ padding: "10px 20px", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "white", border: "none", borderRadius: 14, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
