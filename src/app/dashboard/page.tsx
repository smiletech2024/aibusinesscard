'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard, CustomerSession } from '@/types'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Logo } from '@/components/Logo'

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  ai_chat:    { label: 'AI対話中',  bg: '#EEF2FF', color: '#6366F1' },
  summarized: { label: '要約完了',  bg: '#ECFDF5', color: '#059669' },
  owner_chat: { label: '本会話中',  bg: '#FDF4FF', color: '#9333EA' },
  closed:     { label: '完了',      bg: '#F3F4F6', color: '#6B7280' },
}

function Avatar({ name, size = 40, gradient = false }: { name: string; size?: number; gradient?: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: gradient
          ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
          : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
      }}
    >
      {name[0]}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [cards, setCards] = useState<BusinessCard[]>([])
  const [sessions, setSessions] = useState<CustomerSession[]>([])
  const [loading, setLoading] = useState(true)
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    loadData(user.id)
  }, [router, supabase])

  const loadData = async (userId: string) => {
    const { data: cardsData } = await supabase
      .from('business_cards').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (cardsData) {
      setCards(cardsData)
      const qrUrls: Record<string, string> = {}
      for (const card of cardsData) {
        qrUrls[card.id] = await QRCode.toDataURL(`${window.location.origin}/card/${card.id}`, {
          width: 160, margin: 1, color: { dark: '#1E1B4B', light: '#FFFFFF' }
        })
      }
      setQrDataUrls(qrUrls)
    }
    const { data: personasData } = await supabase.from('personas').select('id').eq('user_id', userId)
    if (personasData?.length) {
      const { data: sessionsData } = await supabase
        .from('customer_sessions').select('*, business_cards(*)')
        .in('persona_id', personasData.map(p => p.id))
        .order('updated_at', { ascending: false }).limit(20)
      if (sessionsData) setSessions(sessionsData as CustomerSession[])
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F3FA" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 rounded-full spin mx-auto mb-4"
            style={{ border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: "#9896B8" }}>読み込み中...</p>
        </div>
      </div>
    )
  }

  const aiChatCount = sessions.filter(s => s.status === 'ai_chat').length
  const summaryCount = sessions.filter(s => s.status === 'summarized' || s.status === 'owner_chat').length

  return (
    <div className="min-h-screen" style={{ background: "#F4F3FA" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Logo size={28} variant="dark" />
          <button onClick={handleLogout} className="text-xs font-medium px-3 py-1.5 rounded-full transition hover:bg-red-50"
            style={{ color: "#9896B8" }}>
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'AI名刺', value: cards.length, unit: '枚', color: '#6366F1' },
              { label: 'AI対話中', value: aiChatCount, unit: '件', color: '#8B5CF6' },
              { label: '引き継ぎ待ち', value: summaryCount, unit: '件', color: '#059669' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="card p-4 text-center">
                <div className="text-2xl font-black mb-0.5" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: "#9896B8" }}>{label}</div>
                <div className="text-xs font-medium" style={{ color }}>{unit}</div>
              </div>
            ))}
          </div>
        )}

        {/* 名刺セクション */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-label mb-1">名刺管理</p>
              <h2 className="text-lg font-black" style={{ color: "#1E1B4B" }}>AI名刺</h2>
            </div>
            <Link href="/setup" className="btn-primary text-sm px-5 py-2.5" style={{ borderRadius: 'var(--radius)' }}>
              + 新規作成
            </Link>
          </div>

          {cards.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#EEF2FF" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="3" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <circle cx="12" cy="14" r="2" />
                </svg>
              </div>
              <h3 className="font-black text-lg mb-2" style={{ color: "#1E1B4B" }}>AI名刺を作成しましょう</h3>
              <p className="text-sm mb-6" style={{ color: "#9896B8" }}>
                ヒアリングAIがあなたの思考と実績を学習し、<br />
                24時間動く分身AIを作成します
              </p>
              <Link href="/setup" className="btn-primary text-sm px-7 py-3" style={{ borderRadius: 'var(--radius)' }}>
                ヒアリングを始める →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map(card => {
                const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/card/${card.id}`
                return (
                  <div key={card.id} className="card overflow-hidden group">
                    {/* Card header gradient */}
                    <div className="h-20 relative" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
                      <div className="absolute inset-0 flex items-end px-5 pb-0">
                        <div className="translate-y-1/2 border-3 border-white rounded-2xl overflow-hidden shadow-md"
                          style={{ border: '3px solid white' }}>
                          <Avatar name={card.full_name} size={52} gradient />
                        </div>
                      </div>
                    </div>

                    <div className="pt-9 px-5 pb-3">
                      <h3 className="font-black text-base" style={{ color: "#1E1B4B" }}>{card.full_name}</h3>
                      {card.title && <p className="text-sm font-medium mt-0.5" style={{ color: "#6366F1" }}>{card.title}</p>}
                      {card.company && <p className="text-xs mt-0.5" style={{ color: "#9896B8" }}>{card.company}</p>}
                    </div>

                    {/* QR + actions */}
                    <div className="px-5 pb-5 flex items-center gap-4">
                      {qrDataUrls[card.id] && (
                        <div className="p-2 rounded-xl flex-shrink-0" style={{ background: "#F4F3FA" }}>
                          <img src={qrDataUrls[card.id]} alt="QR" className="w-14 h-14 rounded-lg" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs mb-2.5" style={{ color: "#9896B8" }}>QRを共有 or URLをコピー</p>
                        <div className="flex flex-wrap gap-2">
                          <a href={cardUrl} target="_blank" rel="noopener noreferrer"
                            className="btn-primary text-xs px-4 py-2" style={{ borderRadius: 'var(--radius-sm)' }}>
                            名刺を見る
                          </a>
                          <Link href={`/print/${card.id}`}
                            className="btn-ghost text-xs px-4 py-2" style={{ borderRadius: 'var(--radius-sm)' }}>
                            印刷用
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* セッション一覧 */}
        {sessions.length > 0 && (
          <div>
            <div className="mb-4">
              <p className="section-label mb-1">顧客管理</p>
              <h2 className="text-lg font-black" style={{ color: "#1E1B4B" }}>顧客との接点</h2>
            </div>
            <div className="space-y-2">
              {sessions.map(session => {
                const st = statusConfig[session.status] || statusConfig.ai_chat
                const name = session.customer_name || '名無し'
                return (
                  <div key={session.id} className="card px-4 py-3.5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <Avatar name={name} size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm truncate" style={{ color: "#1E1B4B" }}>{name}</p>
                        <span className="badge text-xs flex-shrink-0" style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "#9896B8" }}>
                        {new Date(session.updated_at).toLocaleDateString('ja-JP', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {(session.status === 'summarized' || session.status === 'owner_chat') ? (
                        <>
                          <Link href={`/summary/${session.id}`}
                            className="btn-ghost text-xs px-3 py-1.5" style={{ borderRadius: 'var(--radius-sm)' }}>
                            まとめ
                          </Link>
                          <Link href={`/owner/chat/${session.id}`}
                            className="btn-primary text-xs px-3 py-1.5" style={{ borderRadius: 'var(--radius-sm)' }}>
                            チャット
                          </Link>
                        </>
                      ) : (
                        <Link href={`/chat/${session.id}`}
                          className="btn-ghost text-xs px-3 py-1.5" style={{ borderRadius: 'var(--radius-sm)' }}>
                          確認
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
