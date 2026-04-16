'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import LegalLayout from '@/components/LegalLayout'

// ── 型定義 ─────────────────────────────────────────────────────
type MsgRole = 'user' | 'assistant' | 'operator'
type Message = { role: MsgRole; content: string; id?: string }

// セッションキー（タブをまたいでも同じセッション）
function getSessionKey(): string {
  if (typeof window === 'undefined') return ''
  let key = sessionStorage.getItem('support_session_key')
  if (!key) {
    key = crypto.randomUUID()
    sessionStorage.setItem('support_session_key', key)
  }
  return key
}

// ── 香里チャット ────────────────────────────────────────────────
function KaoriChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'こんにちは！サポートスタッフの香里です😊\nご質問・お困りのことがあれば何でもお気軽にどうぞ！プラン・トークン・使い方など、なんでも答えます✨',
    },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [sessionKey]              = useState(() => getSessionKey())
  const [escalated, setEscalated] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [operatorActive, setOperatorActive] = useState(false)
  const [showIntro, setShowIntro]         = useState(true)
  const [customerName, setCustomerName]   = useState('')
  const [meetingCtx, setMeetingCtx]       = useState('')
  const lastPollTimeRef           = useRef<string>(new Date().toISOString())
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const pollTimerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  // 自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ブラウザ通知の許可を取得
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // 通知音を鳴らす
  const playNotification = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch { /* ignore */ }
  }, [])

  // 運営割り込みポーリング（3秒ごと）
  const pollOperator = useCallback(async () => {
    if (!sessionKey) return
    try {
      const res = await fetch(
        `/api/support-chat/poll?session=${sessionKey}&after=${encodeURIComponent(lastPollTimeRef.current)}`
      )
      if (!res.ok) return
      const { messages: newMsgs, operatorActive: active } = await res.json()
      setOperatorActive(active ?? false)
      if (newMsgs?.length) {
        lastPollTimeRef.current = newMsgs[newMsgs.length - 1].created_at
        // 通知音を鳴らす
        playNotification()
        // ブラウザ通知（許可されていれば）
        if (Notification.permission === 'granted') {
          new Notification('💼 運営スタッフからメッセージが届きました', {
            body: newMsgs[newMsgs.length - 1].content,
            icon: '/favicon.ico',
          })
        }
        setMessages(prev => [
          ...prev,
          ...newMsgs.map((m: { id: string; content: string }) => ({
            role: 'operator' as MsgRole,
            content: m.content,
            id: m.id,
          })),
        ])
      }
    } catch { /* ignore */ }
  }, [sessionKey, playNotification])

  useEffect(() => {
    pollTimerRef.current = setInterval(pollOperator, 3000)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [pollOperator])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    const apiMessages = next
      .filter(m => m.role !== 'operator')
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, sessionKey }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '申し訳ありません、エラーが発生しました。少し待ってから再度お試しください🙏' },
        ])
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   reply   = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: reply }
          return updated
        })
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '通信エラーが発生しました。インターネット接続をご確認ください。' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const escalate = async () => {
    if (escalating || escalated) return
    setEscalating(true)
    try {
      await fetch('/api/support-chat/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey }),
      })
      setEscalated(true)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '✅ 運営スタッフへサポートリクエストを送りました！\n\n担当者がこのチャットに参加します。そのままお待ちください。引き続き香里にご質問いただくことも可能です😊',
        },
      ])
    } catch {
      // ignore
    } finally {
      setEscalating(false)
    }
  }

  const startChat = async () => {
    // セッションにコンテキストを保存
    if (sessionKey && (customerName.trim() || meetingCtx.trim())) {
      try {
        await fetch('/api/support-chat/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionKey,
            customerName: customerName.trim(),
            meetingContext: meetingCtx.trim(),
          }),
        })
      } catch { /* ignore */ }
    }
    setShowIntro(false)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{
      border: '2px solid #F26722',
      borderRadius: 20,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 6px 32px rgba(242,103,34,0.12)',
      marginBottom: 32,
    }}>
      {/* ヘッダー — 常に表示 */}
      <div style={{
        background: 'linear-gradient(135deg,#C4511A,#F26722)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          border: '2px solid rgba(255,255,255,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>👩</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>香里（かおり）</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>AI名刺 サポートスタッフ</div>
        </div>
        <div style={{
          marginLeft: 'auto',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 99,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
          24時間対応
        </div>
      </div>

      {/* イントロフォーム */}
      {showIntro ? (
        <div style={{ padding: '28px 20px', background: '#FAF5F0' }}>
          <p style={{ fontSize: 14, color: '#4A2C1A', fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
            こんにちは！サポートスタッフの香里です😊
          </p>
          <p style={{ fontSize: 12.5, color: '#A08068', marginBottom: 20, textAlign: 'center', lineHeight: 1.7 }}>
            よりスムーズにご対応できるよう、<br />
            簡単に教えていただけますか？（任意・スキップOK）
          </p>

          {/* お名前 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A2C1A', display: 'block', marginBottom: 6 }}>
              お名前
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="例：田中 太郎"
              style={{
                width: '100%', padding: '10px 14px', fontSize: 14,
                border: '1.5px solid #EDD9C8', borderRadius: 10,
                background: '#fff', color: '#1C0F05', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 接点 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A2C1A', display: 'block', marginBottom: 8 }}>
              どちらでお会いしましたか？
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {['展示会・イベント', '紹介', 'SNS・Web', '直接お渡し', 'その他'].map(option => (
                <button
                  key={option}
                  onClick={() => setMeetingCtx(meetingCtx === option ? '' : option)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 99,
                    border: `1.5px solid ${meetingCtx === option ? '#F26722' : '#EDD9C8'}`,
                    background: meetingCtx === option ? '#FFF0E8' : '#fff',
                    color: meetingCtx === option ? '#F26722' : '#A08068',
                    fontSize: 12,
                    fontWeight: meetingCtx === option ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={['展示会・イベント', '紹介', 'SNS・Web', '直接お渡し', 'その他'].includes(meetingCtx) ? '' : meetingCtx}
              onChange={e => setMeetingCtx(e.target.value)}
              placeholder="または自由に入力…"
              style={{
                width: '100%', padding: '9px 14px', fontSize: 13,
                border: '1.5px solid #EDD9C8', borderRadius: 10,
                background: '#fff', color: '#1C0F05', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={startChat}
            style={{
              width: '100%', padding: '14px', fontSize: 15, fontWeight: 700,
              background: 'linear-gradient(135deg,#F26722,#F59340)',
              color: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(242,103,34,0.35)',
            }}
          >
            香里に相談する →
          </button>
          <button
            onClick={() => setShowIntro(false)}
            style={{
              width: '100%', padding: '10px', fontSize: 12,
              background: 'none', color: '#C4A882', border: 'none',
              cursor: 'pointer', marginTop: 8,
            }}
          >
            スキップして始める
          </button>
        </div>
      ) : (
        <>
          {/* メッセージ */}
          <div style={{
            height: 380,
            overflowY: 'auto',
            padding: '16px 14px',
            background: '#FAF5F0',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {operatorActive && (
              <div style={{
                background: 'linear-gradient(135deg,#1E40AF,#3B82F6)',
                borderRadius: 10, padding: '10px 14px', margin: '0 0 4px',
                fontSize: 13, color: '#fff', fontWeight: 700, textAlign: 'center',
                boxShadow: '0 2px 12px rgba(59,130,246,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                💼 運営スタッフが対応中です — 少々お待ちください
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser     = msg.role === 'user'
              const isOperator = msg.role === 'operator'

              return (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  gap: 4,
                }}>
                  {!isUser && (
                    <div style={{ fontSize: 10, color: '#A08068', fontWeight: 700, paddingLeft: 4 }}>
                      {isOperator ? '💼 運営スタッフ' : '👩 香里'}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
                    <div style={{
                      maxWidth: '80%',
                      background: isUser
                        ? 'linear-gradient(135deg,#F26722,#F59340)'
                        : isOperator
                          ? 'linear-gradient(135deg,#1E40AF,#3B82F6)'
                          : '#fff',
                      color: isUser ? '#fff' : isOperator ? '#fff' : '#1C0F05',
                      borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      padding: '10px 14px',
                      fontSize: 13,
                      lineHeight: 1.75,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: (!isUser && !isOperator) ? '1px solid #EDD9C8' : 'none',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      {msg.content || (
                        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                          {[0, 0.2, 0.4].map((delay, di) => (
                            <span key={di} style={{
                              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                              background: '#D97706', animation: `dotBlink 1.2s ${delay}s infinite`,
                            }} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* クイック質問 */}
          {messages.length <= 1 && (
            <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #EDD9C8', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['プランについて教えて', 'トークンが足りない', '解約したい', 'QRコードの使い方'].map(q => (
                <button key={q} onClick={() => { setInput(q); }}
                  style={{
                    background: '#FFF0E8', color: '#F26722', border: '1px solid #F26722',
                    borderRadius: 99, padding: '5px 12px', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* 入力 */}
          <div style={{
            padding: '10px 12px',
            background: '#fff',
            borderTop: '1px solid #EDD9C8',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="香里に質問する… (Enterで送信)"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, resize: 'none',
                border: '1.5px solid #EDD9C8', borderRadius: 12,
                padding: '9px 12px', fontSize: 13,
                fontFamily: 'inherit', outline: 'none',
                lineHeight: 1.5, background: '#FAF5F0',
                color: '#1C0F05', maxHeight: 100, overflowY: 'auto',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? 'linear-gradient(135deg,#F26722,#F59340)' : '#EDD9C8',
                color: input.trim() && !loading ? '#fff' : '#A08068',
                border: 'none', borderRadius: 12,
                width: 42, height: 42,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                fontSize: 16, transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              {loading
                ? <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : '➤'}
            </button>
            {!escalated && (
              <button
                onClick={escalate}
                disabled={escalating}
                title="人間のサポートに繋ぐ"
                style={{
                  background: escalating ? '#EDD9C8' : '#FFF0E8',
                  color: escalating ? '#A08068' : '#F26722',
                  border: '1.5px solid #F26722',
                  borderRadius: 12,
                  width: 42, height: 42,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: escalating ? 'not-allowed' : 'pointer',
                  fontSize: 18, flexShrink: 0,
                  transition: 'background 0.2s',
                }}
              >
                🙋
              </button>
            )}
            {escalated && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, borderRadius: 12,
                background: '#D1FAE5', fontSize: 18, flexShrink: 0,
              }}>✅</div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotBlink {
          0%,80%,100% { opacity: 0.15; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── ページ ─────────────────────────────────────────────────────
export default function SupportPage() {
  return (
    <LegalLayout title="サポート">
      <p style={{ fontSize: 13.5, color: '#4A2C1A', lineHeight: 1.8, marginBottom: 24 }}>
        ご質問はAIサポートスタッフの<strong>香里</strong>が24時間即答します。<br />
        <span style={{ fontSize: 12, color: '#A08068' }}>解決しない場合はチャット内の 🙋 ボタンで運営スタッフに繋げます。</span>
      </p>
      <KaoriChat />
    </LegalLayout>
  )
}
