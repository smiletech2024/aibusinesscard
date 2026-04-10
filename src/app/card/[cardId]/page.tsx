'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard } from '@/types'

type CardPageData = BusinessCard & {
  profiles?: { full_name: string | null; avatar_url: string | null }
}

const SESSION_KEY = (cardId: string) => `aimeishi_session_${cardId}`

export default function CardPage() {
  const params = useParams()
  const router = useRouter()
  const cardId = params.cardId as string
  const [card, setCard] = useState<CardPageData | null>(null)
  const [cardDeleted, setCardDeleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [existingSession, setExistingSession] = useState<{ id: string; status: string } | null>(null)
  const supabase = createClient()

  useEffect(() => { loadCard() }, [cardId])

  const loadCard = async () => {
    const { data } = await supabase
      .from('business_cards')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .eq('id', cardId).single()
    if (data && !data.is_active) {
      setCardDeleted(true)
    } else {
      setCard(data ?? null)
    }

    // 同じ端末の既存セッションを確認
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY(cardId)) : null
    if (savedId) {
      const { data: session } = await supabase
        .from('customer_sessions').select('id, status').eq('id', savedId).single()
      if (session && session.status !== 'closed') {
        setExistingSession(session)
      } else {
        // セッションが消えた or 完了済みならリセット
        localStorage.removeItem(SESSION_KEY(cardId))
      }
    }

    setLoading(false)
  }

  const proceedToChat = async () => {
    if (!card?.persona_id) return
    const res = await fetch('/api/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: card.persona_id, cardId: card.id, customerName: customerName || null }),
    })
    const { session } = await res.json()
    if (session) {
      localStorage.setItem(SESSION_KEY(cardId), session.id)
      router.push(`/chat/${session.id}`)
    }
  }

  const continueSession = () => {
    if (!existingSession) return
    if (existingSession.status === 'summarized' || existingSession.status === 'owner_chat') {
      router.push(`/owner/chat/${existingSession.id}`)
    } else {
      router.push(`/chat/${existingSession.id}`)
    }
  }

  const resetSession = () => {
    localStorage.removeItem(SESSION_KEY(cardId))
    setExistingSession(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07060F' }}>
        <div className="w-10 h-10 border-3 rounded-full spin"
          style={{ border: '3px solid rgba(123,110,245,0.3)', borderTopColor: '#7B6EF5' }} />
      </div>
    )
  }

  if (cardDeleted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#07060F' }}>
        <div className="text-center max-w-xs">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(123,110,245,0.1)', border: '1px solid rgba(123,110,245,0.2)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B6EF5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="3" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />
            </svg>
          </div>
          <h2 className="font-black text-lg mb-2" style={{ color: '#EDEEFF' }}>
            この名刺は現在ご利用いただけません
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#5A587E' }}>
            担当者が名刺を削除または停止しました。<br />
            直接ご連絡いただくか、新しい名刺をお受け取りください。
          </p>
        </div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#07060F' }}>
        <div className="text-center" style={{ color: '#EDEEFF' }}>
          <div className="text-5xl mb-4">😕</div>
          <p className="font-bold">名刺が見つかりませんでした</p>
        </div>
      </div>
    )
  }

  const initial = card.full_name?.[0] || '?'

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(123,110,245,0.2) 0%, #07060F 60%)',
        backgroundColor: '#07060F',
      }}
    >
      <div className="w-full max-w-sm space-y-4">

        {/* デジタル名刺 */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: '#0F0E20',
            border: '1px solid rgba(139,92,246,0.15)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* カードヘッダー */}
          <div
            className="relative flex items-center justify-between px-5 pt-5 pb-10"
            style={{ background: 'linear-gradient(135deg, rgba(123,110,245,0.2) 0%, rgba(99,71,240,0.1) 100%)' }}
          >
            {/* AI バッジ */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: '#34D399', display: 'inline-block' }}
              />
              <span className="text-xs font-bold" style={{ color: '#34D399' }}>分身AI オンライン</span>
            </div>
          </div>

          {/* アバター (floated below header) */}
          <div className="flex flex-col items-center -mt-8 px-5 pb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl text-white mb-4"
              style={{
                background: 'linear-gradient(135deg, #6356D4, #7B6EF5)',
                boxShadow: '0 0 0 3px rgba(123,110,245,0.3), 0 0 40px rgba(123,110,245,0.2)',
                border: '2px solid rgba(123,110,245,0.4)',
              }}
            >
              {initial}
            </div>

            <h1 className="text-xl font-bold text-center mb-1" style={{ color: '#EDEEFF' }}>{card.full_name}</h1>
            {card.title && (
              <p className="text-sm font-semibold text-center" style={{ color: '#7B6EF5' }}>{card.title}</p>
            )}
            {card.company && (
              <p className="text-xs text-center mt-0.5" style={{ color: '#5A587E' }}>{card.company}</p>
            )}

            {card.short_intro && (
              <div
                className="mt-4 w-full p-3.5 rounded-xl text-sm leading-relaxed"
                style={{
                  background: '#161428',
                  color: '#9896C4',
                  borderLeft: '3px solid rgba(123,110,245,0.5)',
                }}
              >
                {card.short_intro}
              </div>
            )}

            {/* 連絡先 */}
            <div className="mt-4 w-full space-y-2.5">
              {card.email && (
                <a href={`mailto:${card.email}`} className="flex items-center gap-3 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(123,110,245,0.12)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7B6EF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline truncate" style={{ color: '#9896C4' }}>{card.email}</span>
                </a>
              )}
              {card.phone && (
                <a href={`tel:${card.phone}`} className="flex items-center gap-3 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(123,110,245,0.12)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7B6EF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline" style={{ color: '#9896C4' }}>{card.phone}</span>
                </a>
              )}
              {card.website && (
                <a href={card.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(123,110,245,0.12)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7B6EF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline truncate" style={{ color: '#9896C4' }}>
                    {card.website.replace(/https?:\/\//, '')}
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* CTAエリア */}
        {existingSession ? (
          /* 同じ端末で再アクセス → 既存セッションへ誘導 */
          <div
            className="rounded-2xl p-5"
            style={{
              background: '#0F0E20',
              border: '1px solid rgba(123,110,245,0.2)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6356D4, #7B6EF5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#EDEEFF' }}>会話の続きがあります</p>
                <p className="text-xs" style={{ color: '#5A587E' }}>
                  {existingSession.status === 'summarized' || existingSession.status === 'owner_chat'
                    ? 'AIとの対話が完了 · 本人への引き継ぎ準備ができています'
                    : 'AIとの対話が途中で終わっています'}
                </p>
              </div>
            </div>
            <button
              onClick={continueSession}
              className="w-full py-3 mb-2 font-bold text-white rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #7B6EF5, #9B8BF5)',
                boxShadow: '0 4px 20px rgba(123,110,245,0.4)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {existingSession.status === 'summarized' || existingSession.status === 'owner_chat'
                ? '本人に直接話しかける →'
                : '続きから話す →'}
            </button>
            <button
              onClick={resetSession}
              className="w-full text-center text-xs py-2 transition"
              style={{ color: '#5A587E', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              最初から相談する
            </button>
          </div>
        ) : !showNameInput ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowNameInput(true)}
              className="w-full py-5 text-lg font-bold text-white rounded-2xl flex items-center justify-center gap-3 transition hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #7B6EF5, #9B8BF5)',
                boxShadow: '0 8px 30px rgba(123,110,245,0.45)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              AIに相談する
            </button>
            <div className="grid grid-cols-3 gap-2">
              {['仕事を頼みたい', '話を聞いてみたい', '実績を知りたい'].map(text => (
                <button
                  key={text}
                  onClick={() => setShowNameInput(true)}
                  className="text-xs font-medium py-2.5 px-2 rounded-2xl transition text-center"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#EDEEFF',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-5"
            style={{
              background: '#0F0E20',
              border: '1px solid rgba(123,110,245,0.2)',
            }}
          >
            <h3 className="font-bold mb-1" style={{ color: '#EDEEFF' }}>お名前を教えてください</h3>
            <p className="text-xs mb-4" style={{ color: '#5A587E' }}>入力しなくても話せます。呼びかけてもらえると会話が自然になります</p>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && proceedToChat()}
              placeholder="山田 花子"
              style={{
                width: '100%',
                background: '#161428',
                border: '1.5px solid rgba(139,92,246,0.2)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: '0.925rem',
                color: '#EDEEFF',
                outline: 'none',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,110,245,0.1)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(139,92,246,0.2)'; e.target.style.boxShadow = 'none' }}
            />
            <button
              onClick={proceedToChat}
              className="w-full py-3 font-bold text-white rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #7B6EF5, #9B8BF5)',
                boxShadow: '0 4px 20px rgba(123,110,245,0.4)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              話しかける →
            </button>
            <button
              onClick={() => setShowNameInput(false)}
              className="w-full text-center text-sm py-2 mt-2 transition"
              style={{ color: '#5A587E', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              キャンセル
            </button>
          </div>
        )}

        {/* フッター */}
        <p className="text-center text-xs" style={{ color: '#5A587E' }}>
          Powered by AI名刺
        </p>
      </div>
    </div>
  )
}
