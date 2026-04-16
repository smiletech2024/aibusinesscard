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
  const lastPollTimeRef           = useRef<string>(new Date().toISOString())
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const pollTimerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  // 自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 運営割り込みポーリング（3秒ごと）
  const pollOperator = useCallback(async () => {
    if (!sessionKey) return
    try {
      const res = await fetch(
        `/api/support-chat/poll?session=${sessionKey}&after=${encodeURIComponent(lastPollTimeRef.current)}`
      )
      if (!res.ok) return
      const { messages: newMsgs } = await res.json()
      if (newMsgs?.length) {
        lastPollTimeRef.current = newMsgs[newMsgs.length - 1].created_at
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
  }, [sessionKey])

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
      {/* ヘッダー */}
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
              {/* 名前ラベル */}
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
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotBlink {
          0%,80%,100% { opacity: 0.15; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}

// ── サポートリンクカード ────────────────────────────────────────
const Card = ({ icon, title, desc, href, linkText }: {
  icon: string; title: string; desc: string; href: string; linkText: string
}) => (
  <a href={href}
    target={href.startsWith('mailto') ? '_blank' : undefined}
    rel="noopener noreferrer"
    style={{ display: 'block', background: '#fff', border: '1px solid #EDD9C8', borderRadius: 16, padding: '18px', textDecoration: 'none' }}>
    <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color: '#1C0F05', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 12.5, color: '#A08068', lineHeight: 1.7, marginBottom: 10 }}>{desc}</div>
    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F26722' }}>{linkText} →</div>
  </a>
)

// ── ページ ─────────────────────────────────────────────────────
export default function SupportPage() {
  return (
    <LegalLayout title="サポート">
      <p style={{ fontSize: 13.5, color: '#4A2C1A', lineHeight: 1.8, marginBottom: 24 }}>
        ご質問はAIサポートスタッフの<strong>香里</strong>が24時間即答します。解決しない場合はメールにてご連絡ください。
      </p>

      {/* 香里チャット */}
      <KaoriChat />

      {/* その他のサポートリンク */}
      <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1C0F05', margin: '0 0 12px' }}>その他</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Card icon="💳" title="お支払い・請求"
          desc="領収書・支払い方法の変更はStripeポータルから。"
          href="/pricing" linkText="プランページへ" />
        <Card icon="🔄" title="解約・プラン変更"
          desc="月額プランの解約・変更はいつでも可能です。"
          href="/pricing" linkText="プランページへ" />
        <Card icon="🪙" title="トークン残高"
          desc="トークンの確認・追加購入はこちらから。"
          href="/credits" linkText="トークン補充ページへ" />
        <Card icon="📧" title="メールサポート（人間対応）"
          desc="香里で解決しない場合は担当スタッフが対応します。平日10:00〜18:00。"
          href="mailto:admin@aimeishi.biz" linkText="admin@aimeishi.biz" />
      </div>
    </LegalLayout>
  )
}
