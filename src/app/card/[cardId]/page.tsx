'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard } from '@/types'

type CardPageData = BusinessCard & {
  profiles?: { full_name: string | null; avatar_url: string | null }
}

export default function CardPage() {
  const params = useParams()
  const router = useRouter()
  const cardId = params.cardId as string
  const [card, setCard] = useState<CardPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadCard() }, [cardId])

  const loadCard = async () => {
    const { data, error } = await supabase
      .from('business_cards')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .eq('id', cardId).eq('is_active', true).single()
    setCard(error || !data ? null : data)
    setLoading(false)
  }

  const proceedToChat = async () => {
    if (!card?.persona_id) return
    const res = await fetch('/api/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: card.persona_id, cardId: card.id, customerName: customerName || null }),
    })
    const { session } = await res.json()
    if (session) router.push(`/chat/${session.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
        <div className="w-10 h-10 border-3 rounded-full spin"
          style={{ border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
        <div className="text-center text-white">
          <div className="text-5xl mb-4">😕</div>
          <p className="font-bold">名刺が見つかりませんでした</p>
        </div>
      </div>
    )
  }

  const initial = card.full_name?.[0] || '?'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
      <div className="w-full max-w-sm space-y-4">

        {/* デジタル名刺 */}
        <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: "#FFFFFF" }}>
          {/* カードヘッダー */}
          <div className="relative h-28" style={{ background: 'linear-gradient(135deg, #4338CA 0%, #7C3AED 100%)' }}>
            {/* 装飾円 */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', transform: 'translate(30%, -30%)' }} />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', transform: 'translate(-30%, 30%)' }} />

            {/* AI バッジ */}
            <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              <span className="text-white text-xs font-bold">AI分身 オンライン</span>
            </div>

            {/* アバター */}
            <div className="absolute -bottom-8 left-5">
              <div className="w-16 h-16 rounded-2xl border-3 flex items-center justify-center font-black text-xl text-white shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  border: '3px solid white',
                }}>
                {initial}
              </div>
            </div>
          </div>

          {/* 情報エリア */}
          <div className="pt-12 px-5 pb-5">
            <h1 className="text-xl font-black" style={{ color: "#1E1B4B" }}>{card.full_name}</h1>
            {card.title && (
              <p className="text-sm font-semibold mt-0.5" style={{ color: "#6366F1" }}>{card.title}</p>
            )}
            {card.company && (
              <p className="text-xs mt-0.5" style={{ color: "#9896B8" }}>{card.company}</p>
            )}

            {card.short_intro && (
              <div className="mt-4 p-3.5 rounded-xl text-sm leading-relaxed"
                style={{ background: 'var(--bg)', color: 'var(--text-2)', borderLeft: '3px solid var(--primary)' }}>
                {card.short_intro}
              </div>
            )}

            {/* 連絡先 */}
            <div className="mt-4 space-y-2.5">
              {card.email && (
                <a href={`mailto:${card.email}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EEF2FF" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline truncate" style={{ color: "#4A4870" }}>{card.email}</span>
                </a>
              )}
              {card.phone && (
                <a href={`tel:${card.phone}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EEF2FF" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline" style={{ color: "#4A4870" }}>{card.phone}</span>
                </a>
              )}
              {card.website && (
                <a href={card.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EEF2FF" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline truncate" style={{ color: "#4A4870" }}>
                    {card.website.replace(/https?:\/\//, '')}
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* CTAエリア */}
        {!showNameInput ? (
          <div className="space-y-3">
            <button onClick={() => setShowNameInput(true)}
              className="btn-primary w-full py-4 text-base"
              style={{ borderRadius: '20px', background: 'white', color: '#4F46E5', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              AI分身に相談する
            </button>
            <div className="grid grid-cols-3 gap-2">
              {['仕事を依頼したい', '相性を確認したい', '実績を知りたい'].map(text => (
                <button key={text} onClick={() => setShowNameInput(true)}
                  className="text-xs font-medium py-2.5 px-2 rounded-2xl transition text-center"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-5 shadow-lg" style={{ background: "#FFFFFF" }}>
            <h3 className="font-black mb-1" style={{ color: "#1E1B4B" }}>お名前を教えてください</h3>
            <p className="text-xs mb-4" style={{ color: "#9896B8" }}>任意です。入力しなくても相談できます</p>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="山田 花子"
              className="input-field mb-3"
            />
            <button onClick={proceedToChat} className="btn-primary w-full py-3" style={{ borderRadius: 'var(--radius)' }}>
              チャットを開始する →
            </button>
            <button onClick={() => setShowNameInput(false)}
              className="w-full text-center text-sm py-2 mt-2 transition"
              style={{ color: "#9896B8" }}>
              キャンセル
            </button>
          </div>
        )}

        {/* フッター */}
        <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Powered by AI名刺
        </p>
      </div>
    </div>
  )
}
