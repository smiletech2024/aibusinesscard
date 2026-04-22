'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, AiConversation } from '@/types'
import { subscribePush } from '@/lib/push'

interface Message { role: 'user' | 'assistant' | 'owner' | 'booking'; content: string; saved?: boolean }

// ── インライン予約フォームコンポーネント ─────────────────────────────
function BookingCard({ cardId, ownerName, sessionId, done, onDone }: {
  cardId: string; ownerName: string; sessionId: string; done: boolean; onDone: () => void
}) {
  const [name, setName]       = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 10,
    border: '1.5px solid rgba(242,103,34,0.25)', background: '#1C0F05',
    color: '#FFF0E8', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const submit = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    if (!contact.trim()) { setError('連絡先（メールまたは電話）を入力してください'); return }
    setSubmitting(true); setError('')
    const isEmail = contact.includes('@')
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          customerName:  name.trim(),
          customerEmail: isEmail ? contact.trim() : null,
          customerPhone: isEmail ? null : contact.trim(),
          message:       message.trim() || null,
          sessionId,
        }),
      })
      if (res.ok) { onDone() }
      else { setError('送信に失敗しました。もう一度お試しください。') }
    } catch { setError('通信エラーが発生しました。') }
    finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="fade-up" style={{
        background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(5,150,105,0.06))',
        border: '1px solid rgba(5,150,105,0.3)', borderRadius: 18, padding: '18px 16px',
        maxWidth: 320,
      }}>
        <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>📅</div>
        <p style={{ color: '#34D399', fontWeight: 800, fontSize: 14, textAlign: 'center', marginBottom: 4 }}>
          予約リクエストを送りました！
        </p>
        <p style={{ color: '#A08068', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          {ownerName}から連絡が届くまでお待ちください
        </p>
      </div>
    )
  }

  return (
    <div className="fade-up" style={{
      background: '#0F0E20', border: '1.5px solid rgba(242,103,34,0.3)',
      borderRadius: 18, padding: '16px', maxWidth: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <p style={{ color: '#FFF0E8', fontWeight: 800, fontSize: 14, margin: 0 }}>
          {ownerName}にアポイントを取る
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="お名前 *"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#F26722'}
          onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.25)'}
        />
        <input
          type="text" value={contact} onChange={e => setContact(e.target.value)}
          placeholder="メールアドレスまたは電話番号 *"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#F26722'}
          onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.25)'}
        />
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="相談内容・希望日時など（任意）"
          rows={2}
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
          onFocus={e => e.target.style.borderColor = '#F26722'}
          onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.25)'}
        />
        {error && <p style={{ color: '#F87171', fontSize: 12 }}>{error}</p>}
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
            background: submitting ? '#F5C09A' : 'linear-gradient(135deg, #F26722, #F59340)',
            color: 'white', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(242,103,34,0.35)',
          }}
        >
          {submitting ? '送信中...' : '予約リクエストを送る →'}
        </button>
      </div>
    </div>
  )
}

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
  const [autoHandingOff, setAutoHandingOff]       = useState(false)
  const [bookingDone, setBookingDone]             = useState(false)
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

  // 本人メッセージのポーリング（3秒ごと・APIルート経由でサービスロール取得）
  const knownOwnerMsgIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (viewOnly) return

    const fetchOwnerChats = async (notify: boolean) => {
      try {
        const res = await fetch(`/api/human-chat?sessionId=${sessionId}`)
        if (!res.ok) return
        const { chats } = await res.json()
        if (!Array.isArray(chats)) return
        const ownerChats = chats.filter((c: { sender_role: string }) => c.sender_role === 'owner')
        const newOnes = ownerChats.filter((c: { id: string }) => !knownOwnerMsgIds.current.has(c.id))
        if (newOnes.length === 0) return
        newOnes.forEach((c: { id: string }) => knownOwnerMsgIds.current.add(c.id))
        setMessages(prev => [
          ...prev,
          ...newOnes.map((c: { content: string }) => ({ role: 'owner' as const, content: c.content })),
        ])
        if (notify) {
          setOwnerMessageAlert(true)
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
        }
      } catch { /* ignore */ }
    }

    // 初回：既存メッセージを表示するが通知しない
    fetchOwnerChats(false)
    // 以降：新着のみ通知あり
    const timer = setInterval(() => fetchOwnerChats(true), 3000)
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
        setMessages([{ role: 'assistant', content: aiText.replace(HANDOFF_TOKEN, '').replace(BOOKING_TOKEN, '').trimEnd() }])
      }
      setLoading(false)
      if (checkAndShowBooking(aiText)) return
      await checkAndAutoHandoff(aiText)
    } catch {
      setLoading(false)
    }
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
          // role:'owner'はDeepSeek APIが受け付けないため除外
          messages: newMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content })),
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
        // [[HANDOFF]]トークンはストリーミング中も表示しない
        setMessages(prev => {
          const arr = [...prev]
          arr[arr.length - 1] = { role: 'assistant', content: aiText.replace(HANDOFF_TOKEN, '').replace(BOOKING_TOKEN, '').trimEnd() }
          return arr
        })
      }
      // 3往復目で通知許可を提案
      if (newTurnCount === 3 && !pushAsked) setPushAsked(true)
      setLoading(false)
      // 予約フォーム表示を先に判定
      if (checkAndShowBooking(aiText)) return
      // 自動引き継ぎ判定（手動バナーより優先）
      const didHandoff = await checkAndAutoHandoff(aiText)
      if (!didHandoff && newTurnCount >= 8) setShowSummaryPrompt(true)
    } catch {
      setLoading(false)
    }
  }

  const HANDOFF_TOKEN  = '[[HANDOFF]]'
  const BOOKING_TOKEN  = '[[SHOW_BOOKING]]'

  const createSummary = async (auto = false) => {
    if (summarizing) return
    if (auto) setAutoHandingOff(true)
    setSummarizing(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (data.summary) router.push(`/summary/${sessionId}`)
    } finally {
      setSummarizing(false)
      setAutoHandingOff(false)
    }
  }

  // [[SHOW_BOOKING]] 検出 → インライン予約フォームをメッセージとして追加
  const checkAndShowBooking = (aiText: string): boolean => {
    if (!aiText.includes(BOOKING_TOKEN)) return false
    const cleaned = aiText.replace(BOOKING_TOKEN, '').trimEnd()
    setMessages(prev => {
      const arr = [...prev]
      arr[arr.length - 1] = { role: 'assistant', content: cleaned }
      return [...arr, { role: 'booking', content: '' }]
    })
    return true
  }

  // AIの応答に [[HANDOFF]] が含まれているか検出し自動引き継ぎ
  const checkAndAutoHandoff = async (aiText: string) => {
    if (!aiText.includes(HANDOFF_TOKEN)) return false
    // トークンを表示から取り除いて更新
    const cleaned = aiText.replace(HANDOFF_TOKEN, '').trimEnd()
    setMessages(prev => {
      const arr = [...prev]
      arr[arr.length - 1] = { role: 'assistant', content: cleaned }
      return arr
    })
    // 少し待ってから自動引き継ぎ（メッセージを読んでもらう時間）
    await new Promise(r => setTimeout(r, 1800))
    await createSummary(true)
    return true
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
              {session?.status === 'owner_chat' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#60A5FA' }} />
                  <p className="text-xs truncate" style={{ color: '#60A5FA', fontWeight: 600 }}>
                    {ownerName}本人からの返信を待っています
                  </p>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34D399' }} />
                  <p className="text-xs truncate" style={{ color: '#6B4030' }}>
                    {ownerCard?.title || '本人監修のAI'}{ownerCard?.company ? ` · ${ownerCard.company}` : ''}
                  </p>
                </>
              )}
            </div>
          </div>
          {turnCount >= 5 && !autoHandingOff && (
            <button
              onClick={() => createSummary(false)}
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
          const isUser    = msg.role === 'user'
          const isOwner   = msg.role === 'owner'
          const isAssist  = msg.role === 'assistant'
          const isBooking = msg.role === 'booking'

          // ── インライン予約フォーム ──
          if (isBooking) {
            return (
              <BookingCard
                key={i}
                cardId={session?.business_cards?.id ?? ''}
                ownerName={ownerName}
                sessionId={sessionId}
                done={bookingDone}
                onDone={() => setBookingDone(true)}
              />
            )
          }

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

      {/* 自動引き継ぎ中オーバーレイ */}
      {autoHandingOff && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(7,6,15,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, #E05A18, #F5843A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 0 40px rgba(242,103,34,0.5)',
          }}>👤</div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#FFF0E8', fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
              {ownerName}本人に繋いでいます
            </p>
            <p style={{ color: '#A08068', fontSize: 13 }}>会話の内容をまとめています…</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="dot-pulse" style={{ background: '#F5843A', width: 8, height: 8, borderRadius: '50%', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* サマリー提案バナー（自動引き継ぎしなかった場合の手動フォールバック） */}
      {showSummaryPrompt && !summarizing && !autoHandingOff && (
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
              onClick={() => createSummary(false)}
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
