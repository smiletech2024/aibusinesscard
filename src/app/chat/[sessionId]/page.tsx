'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, AiConversation } from '@/types'

interface Message { role: 'user' | 'assistant'; content: string; saved?: boolean }

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<CustomerSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => { loadSession() }, [sessionId])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadSession = async () => {
    const { data: sessionData } = await supabase
      .from('customer_sessions')
      .select('*, personas(*, profiles:user_id(*)), business_cards(*)')
      .eq('id', sessionId).single()
    if (!sessionData) return
    setSession(sessionData as CustomerSession)
    const { data: convs } = await supabase
      .from('ai_conversations').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
    if (convs?.length) {
      setMessages(convs.map((c: AiConversation) => ({ role: c.role, content: c.content, saved: true })))
      setTurnCount(convs.filter((c: AiConversation) => c.role === 'user').length)
    } else {
      startConversation(sessionData as CustomerSession)
    }
  }

  const startConversation = async (sessionData: CustomerSession) => {
    if (!sessionData.personas) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], sessionId, personaId: sessionData.persona_id }),
      })
      let aiText = ''
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      setMessages([{ role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiText += decoder.decode(value)
        setMessages([{ role: 'assistant', content: aiText }])
      }
    } finally { setLoading(false) }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !session) return
    const userMessage = input.trim()
    setInput('')
    await supabase.from('ai_conversations').insert({ session_id: sessionId, role: 'user', content: userMessage })
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage, saved: true }]
    setMessages(newMessages)
    setLoading(true)
    const newTurnCount = turnCount + 1
    setTurnCount(newTurnCount)
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId, personaId: session.persona_id,
        }),
      })
      let aiText = ''
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      setMessages([...newMessages, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiText += decoder.decode(value)
        setMessages(prev => {
          const arr = [...prev]; arr[arr.length - 1] = { role: 'assistant', content: aiText }; return arr
        })
      }
      if (newTurnCount >= 8) setShowSummaryPrompt(true)
    } finally { setLoading(false) }
  }

  const createSummary = async () => {
    setSummarizing(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (data.summary) router.push(`/summary/${sessionId}`)
    } finally { setSummarizing(false) }
  }

  const ownerName = session?.business_cards?.full_name || '担当者'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F4F3FA" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 shadow-md" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
            {ownerName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm leading-tight">{ownerName}の分身AI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
              <p className="text-white/60 text-xs truncate">本人監修 · 会話は後でオーナーに共有されます</p>
            </div>
          </div>
          {turnCount >= 5 && (
            <button onClick={createSummary} disabled={summarizing}
              className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 transition"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              {summarizing ? '要約中...' : '引き継ぎ →'}
            </button>
          )}
        </div>
      </div>

      {/* 注意書き */}
      <div className="px-4 py-2 text-center" style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
        <p className="text-xs font-medium" style={{ color: '#92400E' }}>
          このAIは{ownerName}の分身です。契約・価格の確定は本人に引き継ぎます
        </p>
      </div>

      {/* メッセージ */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white shadow-sm"
                style={{ background: 'var(--grad-primary)' }}>
                AI
              </div>
            )}
            <div className={`max-w-xs sm:max-w-md ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}
              style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content || (
                <span className="flex items-center gap-1.5 py-0.5">
                  <span className="dot-pulse"></span>
                  <span className="dot-pulse"></span>
                  <span className="dot-pulse"></span>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* サマリー提案バナー */}
      {showSummaryPrompt && !summarizing && (
        <div className="px-4 py-3 border-t" style={{ background: '#F5F3FF', borderColor: '#DDD6FE' }}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#5B21B6' }}>十分な会話ができました！</p>
              <p className="text-xs" style={{ color: '#7C3AED' }}>会話をまとめて{ownerName}本人に引き継ぎますか？</p>
            </div>
            <button onClick={createSummary}
              className="btn-primary text-xs px-4 py-2 flex-shrink-0" style={{ borderRadius: 'var(--radius-sm)' }}>
              まとめへ →
            </button>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="px-4 pb-6 pt-3 max-w-2xl mx-auto w-full">
        <div className="flex gap-2 p-2 rounded-2xl shadow-md" style={{ background: "#fff", border: "1.5px solid #E8E6F5" }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || summarizing}
            placeholder="メッセージを入力..."
            className="flex-1 bg-transparent outline-none px-3 text-sm"
            style={{ color: "#1E1B4B" }}
          />
          <button onClick={sendMessage}
            disabled={loading || !input.trim() || summarizing}
            style={{ padding: "10px 16px", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "white", border: "none", borderRadius: 14, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
