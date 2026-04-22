'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, AiConversation } from '@/types'
import { subscribePush } from '@/lib/push'

interface Message { role: 'user' | 'assistant' | 'owner'; content: string; saved?: boolean }

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
  const [showBranding, setShowBranding] = useState(false)
  const [ownerMessageAlert, setOwnerMessageAlert] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (viewOnly) { router.replace(`/owner/chat/${sessionId}`); return }
    loadSession()
  }, [sessionId])

  // 本人メッセージのポーリング（3秒ごとに新着チェック）
  const knownOwnerMsgIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (viewOnly) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/human-chat?sessionId=${sessionId}`)
        if (!res.ok) return
        const { chats } = await res.json()
        if (!chats) return
        const ownerChats = (chats as { id: string; sender_role: string; content: string }[])
          .filter(c => c.sender_role === 'owner')
        const newOnes = ownerChats.filter(c => !knownOwnerMsgIds.current.has(c.id))
        if (newOnes.length === 0) return
        newOnes.forEach(c => knownOwnerMsgIds.current.add(c.id))
        setMessages(prev => [
          ...prev,
          ...newOnes.map(c => ({ role: 'owner' as const, content: c.content })),
        ])
        setOwnerMessageAlert(true)
        // 通知音
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(660, ctx.currentTime)
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12)
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    // 初回ロード時：既存メッセージをknown扱いにする（通知しない）
    const init = async () => {
      try {
        const res = await fetch(`/api/human-chat?sessionId=${sessionId}`)
        if (!res.ok) return
        const { chats } = await res.json()
        if (!chats) return
        const ownerChats = (chats as { id: string; sender_role: string; content: string }[])
          .filter(c => c.sender_role === 'owner')
        ownerChats.forEach(c => knownOwnerMsgIds.current.add(c.id))
        // 既存の本人メッセージをチャットに表示
        if (ownerChats.length > 0) {
          setMessages(prev => {
            const existing = new Set(prev.filter(m => m.role === 'owner').map(m => m.content))
            const toAdd = ownerChats.filter(c => !existing.has(c.content))
            return toAdd.length > 0
              ? [...prev, ...toAdd.map(c => ({ role: 'owner' as const, content: c.content }))]
              : prev
          })
        }
      } catch { /* ignore */ }
    }
    init()
    const timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [sessionId, viewOnly])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadSession = async () => {
    const { data: sessionData } = await supabase
      .from('customer_sessions')
      .select('*, personas(*, profiles:user_id(*)), business_cards(*)')
      .eq('id', sessionId).single()
    if (!sessionData) return
    setSession(sessionData as CustomerSession)
    // オーナーのプランに応じてブランド表示を決定
    const ownerId = (sessionData as CustomerSession & { personas?: { user_id?: string } }).personas?.user_id
    if (ownerId) {
      fetch(`/api/plan/branding?userId=${ownerId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setShowBranding(d.showBranding) })
        .catch(() => {})
    }
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
          userMessage,
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

  const ownerName    = session?.business_cards?.full_name || '担当者'
  const ownerCard    = session?.business_cards ?? null
  const ownerInitial = ownerName[0] || '?'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#09081A' }}>
      {/* Header — シンプルなスティッキーバー */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: '#0F0E20',
          borderBottom: '1px solid rgba(242,103,34,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #E05A18, #F5843A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 900, fontSize: 13,
              boxShadow: '0 0 10px rgba(242,103,34,0.3)',
            }}
          >
            {ownerInitial}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm leading-tight truncate" style={{ color: '#FFF0E8' }}>
              {ownerName}の分身AI
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34D399' }} />
              <p className="text-xs truncate" style={{ color: '#6B4030' }}>
                {ownerCard?.title || '本人監修のAI'}{ownerCard?.company ? ` · ${ownerCard.company}` : ''}
              </p>
            </div>
          </div>
          {turnCount >= 5 && (
            <button
              onClick={createSummary}
              disabled={summarizing}
              className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0"
              style={{
                background: 'rgba(242,103,34,0.15)',
                color: '#F59340',
                border: '1px solid rgba(242,103,34,0.3)',
                cursor: 'pointer',
              }}
            >
              {summarizing ? '整理中...' : '本人へ橋渡し →'}
            </button>
          )}
        </div>
      </div>

      {/* 本人からメッセージ届いたバナー */}
      {ownerMessageAlert && (
        <div
          style={{
            background: 'linear-gradient(135deg,#1E40AF,#2563EB)',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', flexShrink: 0 }} />
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>
              {ownerName}本人からメッセージが届きました👇
            </p>
          </div>
          <button
            onClick={() => setOwnerMessageAlert(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}
          >×</button>
        </div>
      )}

      {/* メッセージ */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* ── プロフィールカード（常時表示・スクロールで流れる） ── */}
        {ownerCard && (
          <div style={{
            background: '#0F0E20',
            border: '1px solid rgba(242,103,34,0.2)',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 4,
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* アバター */}
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'linear-gradient(135deg, #E05A18, #F5843A)',
                border: '2px solid rgba(242,103,34,0.35)',
                boxShadow: '0 0 18px rgba(242,103,34,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 900, fontSize: 20,
              }}>
                {ownerInitial}
              </div>
              {/* テキスト */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#FFF0E8', fontWeight: 800, fontSize: 16 }}>{ownerName}</div>
                {ownerCard.title && (
                  <div style={{ color: '#F5843A', fontSize: 12, fontWeight: 600, marginTop: 2 }}>{ownerCard.title}</div>
                )}
                {ownerCard.company && (
                  <div style={{ color: '#A08068', fontSize: 12, marginTop: 1 }}>{ownerCard.company}</div>
                )}
                {/* オンラインバッジ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: '#34D399', fontWeight: 700 }}>分身AI オンライン</span>
                </div>
              </div>
            </div>
            {/* 自己紹介 */}
            {ownerCard.short_intro && (
              <div style={{
                marginTop: 12,
                color: '#A08068',
                fontSize: 12.5,
                lineHeight: 1.75,
                background: 'rgba(242,103,34,0.05)',
                borderLeft: '3px solid rgba(242,103,34,0.4)',
                padding: '8px 12px',
                borderRadius: '0 8px 8px 0',
              }}>
                {ownerCard.short_intro}
              </div>
            )}
            <div style={{
              marginTop: 10, fontSize: 11, color: '#3D2517', textAlign: 'center',
              borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8,
            }}>
              このAIは{ownerName}本人が学習させた分身です
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser     = msg.role === 'user'
          const isOwner    = msg.role === 'owner'
          const isAssist   = msg.role === 'assistant'
          return (
            <div key={i} className={`flex gap-2.5 fade-up ${isUser ? 'justify-end' : 'justify-start'}`}>
              {/* アバター */}
              {isAssist && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #E05A18, #F5843A)' }}>AI</div>
              )}
              {isOwner && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #1E40AF, #3B82F6)' }}
                >{ownerName[0]}</div>
              )}

              <div className="flex flex-col gap-1 max-w-xs sm:max-w-md">
                {/* 送信者ラベル */}
                {isOwner && (
                  <p className="text-xs font-bold" style={{ color: '#60A5FA' }}>
                    👤 {ownerName}本人
                  </p>
                )}
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    padding: '10px 14px',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    fontSize: 14, lineHeight: 1.75,
                    background: isUser
                      ? 'linear-gradient(135deg,#F26722,#F59340)'
                      : isOwner
                        ? 'linear-gradient(135deg,#1E40AF,#3B82F6)'
                        : '#1C0F05',
                    color: (isUser || isOwner) ? '#fff' : '#FFF0E8',
                    border: (!isUser && !isOwner) ? '1px solid rgba(242,103,34,0.12)' : 'none',
                    boxShadow: isOwner ? '0 4px 16px rgba(37,99,235,0.3)' : isUser ? '0 4px 16px rgba(242,103,34,0.2)' : 'none',
                  }}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1.5 py-0.5">
                      <span className="dot-pulse" style={{ background: '#A08068' }} />
                      <span className="dot-pulse" style={{ background: '#A08068' }} />
                      <span className="dot-pulse" style={{ background: '#A08068' }} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
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
                style={{ background: 'rgba(255,255,255,0.08)', color: '#A08068', border: 'none', cursor: 'pointer' }}
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
            background: '#1C0F05',
            borderTop: '1px solid rgba(242,103,34,0.2)',
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#FFF0E8' }}>本人に引き継ぐ準備ができました</p>
              <p className="text-xs mt-0.5" style={{ color: '#A08068' }}>
                会話をまとめて{ownerName}へ橋渡しします
              </p>
            </div>
            <button
              onClick={createSummary}
              className="text-xs font-bold px-4 py-2.5 rounded-xl flex-shrink-0 text-white"
              style={{
                background: 'linear-gradient(135deg, #F5843A, #F59340)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(242,103,34,0.35)',
              }}
            >
              まとめへ →
            </button>
          </div>
        </div>
      )}

      {/* 本人閲覧モード：直接チャットボタン */}
      {viewOnly && (
        <div
          className="px-4 pb-6 pt-3 max-w-2xl mx-auto w-full"
          style={{ background: '#0F0E20', boxShadow: '0 -8px 32px rgba(7,6,15,0.8)' }}
        >
          <button
            onClick={() => router.push(`/owner/chat/${sessionId}`)}
            className="w-full py-3.5 font-bold text-white rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #F5843A, #F59340)',
              border: 'none', cursor: 'pointer', fontSize: '0.95rem',
              boxShadow: '0 4px 20px rgba(242,103,34,0.4)',
            }}
          >
            このお客様と直接話す →
          </button>
        </div>
      )}

      {/* 入力エリア（お客様用） */}
      {!viewOnly && <div
        className="px-4 pb-6 pt-3 max-w-2xl mx-auto w-full"
        style={{
          background: '#0F0E20',
          boxShadow: '0 -8px 32px rgba(7,6,15,0.8)',
        }}
      >
        <div
          className="flex gap-2 p-2 rounded-2xl"
          style={{
            background: '#1C0F05',
            border: '1px solid rgba(242,103,34,0.15)',
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
            style={{ color: '#FFF0E8', lineHeight: '1.5', paddingTop: 10, paddingBottom: 10, overflowY: 'hidden' }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || summarizing}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #E05A18, #F5843A)',
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
      </div>}

      {/* ブランドウォーターマーク（フリープランのみ表示）*/}
      {showBranding && (
        <div style={{
          textAlign: 'center', padding: '6px 0 10px',
          background: '#09081A',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <a
            href="https://ai-meishi.jp"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10, color: 'rgba(160,128,104,0.5)',
              textDecoration: 'none', letterSpacing: '0.05em',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
            Powered by AI名刺
          </a>
        </div>
      )}
    </div>
  )
}
