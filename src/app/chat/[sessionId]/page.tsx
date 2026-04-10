'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, AiConversation } from '@/types'
import { subscribePush } from '@/lib/push'

interface Message { role: 'user' | 'assistant'; content: string; saved?: boolean }

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewOnly = searchParams.get('view') === '1'
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<CustomerSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushAsked, setPushAsked] = useState(false)
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
    const res = await fetch(`/api/conversations?sessionId=${sessionId}`)
    const json = await res.json()
    const convs: AiConversation[] = json.conversations ?? []
    if (convs.length > 0) {
      setMessages(convs.map((c: AiConversation) => ({ role: c.role, content: c.content, saved: true })))
      setTurnCount(convs.filter((c: AiConversation) => c.role === 'user').length)
    } else if (!viewOnly) {
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
      // 3往復目で通知許可を提案
      if (newTurnCount === 3 && !pushAsked) setPushAsked(true)
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
    <div className="min-h-screen flex flex-col" style={{ background: '#09081A' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: '#0F0E20',
          borderBottom: '1px solid rgba(139,92,246,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6356D4, #7B6EF5)',
              color: 'white',
              boxShadow: '0 0 12px rgba(123,110,245,0.3)',
            }}
          >
            AI
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm leading-tight" style={{ color: '#EDEEFF' }}>
              {ownerName}の分身AI
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34D399' }} />
              <p className="text-xs truncate" style={{ color: '#5A587E' }}>
                本人監修のAI · 会話は後で本人に届きます
              </p>
            </div>
          </div>
          {turnCount >= 5 && (
            <button
              onClick={createSummary}
              disabled={summarizing}
              className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 transition"
              style={{
                background: 'rgba(123,110,245,0.15)',
                color: '#9B8BF5',
                border: '1px solid rgba(123,110,245,0.3)',
                cursor: 'pointer',
              }}
            >
              {summarizing ? '整理中...' : '本人へ橋渡し →'}
            </button>
          )}
        </div>
      </div>

      {/* 注意書き */}
      <div
        className="px-4 py-2.5 text-center"
        style={{
          background: 'rgba(123,110,245,0.08)',
          borderBottom: '1px solid rgba(139,92,246,0.2)',
        }}
      >
        <p className="text-xs font-medium" style={{ color: '#9896C4' }}>
          このAIは{ownerName}本人が学習させた分身です。具体的な契約・金額は本人が対応します
        </p>
      </div>

      {/* メッセージ */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6356D4, #7B6EF5)' }}
              >
                AI
              </div>
            )}
            <div
              className={`max-w-xs sm:max-w-md ${msg.role === 'user' ? 'bubble-user-dark' : 'bubble-ai-dark'}`}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {msg.content || (
                <span className="flex items-center gap-1.5 py-0.5">
                  <span className="dot-pulse" style={{ background: '#9896C4' }} />
                  <span className="dot-pulse" style={{ background: '#9896C4' }} />
                  <span className="dot-pulse" style={{ background: '#9896C4' }} />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 通知許可バナー */}
      {pushAsked && !pushEnabled && (
        <div
          className="px-4 py-3"
          style={{
            background: 'rgba(37,99,235,0.1)',
            borderTop: '1px solid rgba(37,99,235,0.2)',
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <span style={{ fontSize: 20, flexShrink: 0 }}>🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#93C5FD' }}>本人からの返信を通知で受け取る</p>
              <p className="text-xs" style={{ color: '#60A5FA' }}>このページを閉じていても届きます</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={async () => {
                  const ok = await subscribePush(sessionId, 'customer')
                  setPushEnabled(ok)
                  setPushAsked(false)
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                受け取る
              </button>
              <button
                onClick={() => setPushAsked(false)}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#9896C4', border: 'none', cursor: 'pointer' }}
              >
                あとで
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サマリー提案バナー */}
      {showSummaryPrompt && !summarizing && (
        <div
          className="px-4 py-4"
          style={{
            background: '#161428',
            borderTop: '1px solid rgba(139,92,246,0.2)',
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#EDEEFF' }}>本人に引き継ぐ準備ができました</p>
              <p className="text-xs mt-0.5" style={{ color: '#9896C4' }}>
                会話をまとめて{ownerName}へ橋渡しします
              </p>
            </div>
            <button
              onClick={createSummary}
              className="text-xs font-bold px-4 py-2.5 rounded-xl flex-shrink-0 text-white"
              style={{
                background: 'linear-gradient(135deg, #7B6EF5, #9B8BF5)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(123,110,245,0.35)',
              }}
            >
              まとめへ →
            </button>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div
        className="px-4 pb-6 pt-3 max-w-2xl mx-auto w-full"
        style={{
          background: '#0F0E20',
          boxShadow: '0 -8px 32px rgba(7,6,15,0.8)',
        }}
      >
        <div
          className="flex gap-2 p-2 rounded-2xl"
          style={{
            background: '#161428',
            border: '1px solid rgba(139,92,246,0.15)',
          }}
        >
          <textarea
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={e => {
              // PCのみEnterで送信（スマホはボタンを使う）
              if (e.key === 'Enter' && !e.shiftKey && !/iPhone|iPad|Android/i.test(navigator.userAgent)) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={loading || summarizing}
            placeholder="メッセージを入力..."
            rows={1}
            className="flex-1 bg-transparent outline-none px-3 text-sm resize-none"
            style={{ color: '#EDEEFF', lineHeight: '1.5', paddingTop: 10, paddingBottom: 10, overflowY: 'hidden' }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || summarizing}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #6356D4, #7B6EF5)',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading || !input.trim() || summarizing ? 0.5 : 1,
            }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 rounded-full spin"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
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
