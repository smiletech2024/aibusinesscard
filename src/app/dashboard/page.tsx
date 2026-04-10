'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard, CustomerSession } from '@/types'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Logo } from '@/components/Logo'

const statusConfig: Record<string, { label: string; bg: string; color: string; step: number }> = {
  ai_chat:    { label: 'AIと会話中',    bg: 'rgba(99,102,241,0.1)',  color: '#818CF8', step: 2 },
  summarized: { label: 'まとめ確認中',  bg: 'rgba(52,211,153,0.1)',  color: '#34D399', step: 3 },
  owner_chat: { label: 'チャット希望',  bg: 'rgba(167,139,250,0.1)', color: '#A78BFA', step: 4 },
  closed:     { label: '完了',          bg: 'rgba(156,163,175,0.1)', color: '#9CA3AF', step: 0 },
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
  const [qrModal, setQrModal] = useState<{ url: string; cardUrl: string; name: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deleteSessionConfirm, setDeleteSessionConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<{ id: string; customerName: string; sessionId: string }[]>([])
  const personaIdsRef = useRef<string[]>([])
  const supabase = createClient()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    loadData(user.id)
  }, [router, supabase])

  const loadData = async (userId: string) => {
    const { data: cardsData } = await supabase
      .from('business_cards').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false })
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
      const ids = personasData.map(p => p.id)
      personaIdsRef.current = ids

      const { data: sessionsData } = await supabase
        .from('customer_sessions').select('*, business_cards(*)')
        .in('persona_id', ids)
        .order('updated_at', { ascending: false }).limit(20)
      if (sessionsData) setSessions(sessionsData as CustomerSession[])
      setLoading(false)

      // リアルタイム購読：owner_chat / summarized になったら通知
      const channel = supabase
        .channel('dashboard_sessions')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'customer_sessions' },
          payload => {
            const updated = payload.new as CustomerSession
            if (!personaIdsRef.current.includes(updated.persona_id)) return

            // セッション一覧を更新
            setSessions(prev =>
              prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)
            )

            // owner_chat または summarized になった場合に通知
            if (updated.status === 'owner_chat' || updated.status === 'summarized') {
              const customerName = updated.customer_name || 'お客様'
              setNotifications(prev => {
                if (prev.some(n => n.sessionId === updated.id)) return prev
                return [...prev, { id: crypto.randomUUID(), customerName, sessionId: updated.id }]
              })
              // ブラウザ通知（許可済みの場合）
              if (typeof window !== 'undefined' && Notification.permission === 'granted') {
                new Notification('💬 顧客が本会話を希望しています', {
                  body: `${customerName}との会話準備が整いました`,
                  icon: '/favicon.ico',
                })
              }
            }
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    setLoading(false)
  }

  // ブラウザ通知の許可リクエスト
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleDeleteCard = async (cardId: string) => {
    await supabase.from('business_cards').update({ is_active: false }).eq('id', cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
    setDeleteConfirm(null)
  }

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId)
    const res = await fetch('/api/session/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    if (res.ok) {
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    }
    setDeletingSessionId(null)
    setDeleteSessionConfirm(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F4FC' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 rounded-full spin mx-auto mb-4"
            style={{ border: '3px solid #E8E6F5', borderTopColor: '#6366F1' }} />
          <p className="text-sm" style={{ color: '#9896B8' }}>読み込み中...</p>
        </div>
      </div>
    )
  }

  const aiChatCount = sessions.filter(s => s.status === 'ai_chat').length
  const summaryCount = sessions.filter(s => s.status === 'summarized' || s.status === 'owner_chat').length

  return (
    <div className="min-h-screen" style={{ background: '#F5F4FC' }}>

      {/* QR拡大モーダル */}
      {qrModal && (
        <div
          onClick={() => setQrModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 24, padding: '28px 24px',
              maxWidth: 320, width: '100%', textAlign: 'center',
              boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9896B8', marginBottom: 4 }}>
              このQRコードを読み取ってください
            </p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B', marginBottom: 20 }}>
              {qrModal.name}
            </p>
            <div style={{
              display: 'inline-block', padding: 12, borderRadius: 16,
              background: '#F4F3FA', marginBottom: 20,
            }}>
              <img src={qrModal.url} alt="QR" style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }} />
            </div>
            <p style={{ fontSize: 11, color: '#9896B8', marginBottom: 20, wordBreak: 'break-all' }}>
              {qrModal.cardUrl}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={qrModal.cardUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white',
                  textDecoration: 'none', display: 'block',
                }}>
                名刺を開く →
              </a>
              <button onClick={() => setQrModal(null)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: '#F4F3FA', color: '#6B7280', border: 'none', cursor: 'pointer',
                }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirm && (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: '28px 24px',
              maxWidth: 320, width: '100%', textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: '#FEF2F2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <p style={{ fontWeight: 900, fontSize: 16, color: '#1E1B4B', marginBottom: 8 }}>
              この名刺を削除しますか？
            </p>
            <p style={{ fontSize: 13, color: '#9896B8', marginBottom: 6 }}>
              「{deleteConfirm.name}」
            </p>
            <p style={{ fontSize: 12, color: '#9896B8', marginBottom: 24, lineHeight: 1.6 }}>
              削除後はQRコードを読み取っても<br />使えなくなります。この操作は取り消せません。
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleDeleteCard(deleteConfirm.id)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer',
                }}
              >
                削除する
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: '#F4F3FA', color: '#6B7280', border: 'none', cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* セッション削除確認モーダル */}
      {deleteSessionConfirm && (
        <div
          onClick={() => setDeleteSessionConfirm(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: '28px 24px',
              maxWidth: 320, width: '100%', textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: '#FEF2F2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <p style={{ fontWeight: 900, fontSize: 16, color: '#1E1B4B', marginBottom: 8 }}>
              この会話履歴を削除しますか？
            </p>
            <p style={{ fontSize: 13, color: '#9896B8', marginBottom: 6 }}>
              「{deleteSessionConfirm.name}」との会話
            </p>
            <p style={{ fontSize: 12, color: '#9896B8', marginBottom: 24, lineHeight: 1.6 }}>
              AI会話・まとめ・チャット履歴をすべて削除します。<br />この操作は取り消せません。
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleDeleteSession(deleteSessionConfirm.id)}
                disabled={!!deletingSessionId}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: '#EF4444', color: 'white', border: 'none',
                  cursor: deletingSessionId ? 'not-allowed' : 'pointer',
                  opacity: deletingSessionId ? 0.7 : 1,
                }}
              >
                {deletingSessionId ? '削除中...' : '削除する'}
              </button>
              <button
                onClick={() => setDeleteSessionConfirm(null)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: '#F4F3FA', color: '#6B7280', border: 'none', cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderColor: '#E8E6F5' }}
      >
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Logo size={28} variant="dark" />
          <button
            onClick={handleLogout}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition hover:bg-red-50"
            style={{ color: '#9896B8' }}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* 通知バナー */}
      {notifications.length > 0 && (
        <div className="sticky top-14 z-10">
          {notifications.map(n => (
            <div
              key={n.id}
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 4px 24px rgba(99,102,241,0.45)',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, animation: 'pulse 1.5s infinite',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>
                  {n.customerName}が本会話を希望しています
                </p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  AIが整理済み · すぐに本題から話せます
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/owner/chat/${n.sessionId}`}
                  style={{
                    background: 'white', color: '#6366F1', fontWeight: 700,
                    fontSize: 13, padding: '8px 16px', borderRadius: 20,
                    textDecoration: 'none', display: 'block', whiteSpace: 'nowrap',
                  }}
                >
                  話しかける →
                </Link>
                <button
                  onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: 'white',
                    border: 'none', cursor: 'pointer', borderRadius: '50%',
                    width: 32, height: 32, fontSize: 16, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'AI名刺', value: cards.length, unit: '枚', color: '#6366F1', borderColor: '#6366F1' },
              { label: 'AI対話中', value: aiChatCount, unit: '件', color: '#8B5CF6', borderColor: '#8B5CF6' },
              { label: '返事を待っています', value: summaryCount, unit: '件', color: '#059669', borderColor: '#059669' },
            ].map(({ label, value, unit, color, borderColor }) => (
              <div
                key={label}
                className="p-5 text-center rounded-2xl"
                style={{
                  background: 'white',
                  border: '1px solid #E8E6F5',
                  borderLeft: `3px solid ${borderColor}`,
                  boxShadow: '0 1px 3px rgba(99,102,241,0.06)',
                }}
              >
                <div className="text-3xl font-black mb-1" style={{ color }}>{value}</div>
                <div className="text-xs font-medium" style={{ color: '#9896B8' }}>{label}</div>
                <div className="text-xs" style={{ color }}>{unit}</div>
              </div>
            ))}
          </div>
        )}

        {/* 名刺セクション */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-label mb-1">名刺管理</p>
              <h2 className="text-lg font-black" style={{ color: '#1E1B4B' }}>AI名刺</h2>
            </div>
            <Link
              href="/setup"
              className="btn-primary text-sm px-5 py-2.5"
              style={{ borderRadius: 14 }}
            >
              + 新規作成
            </Link>
          </div>

          {cards.length === 0 ? (
            <div
              className="p-12 text-center rounded-2xl"
              style={{ background: 'white', border: '1px solid #E8E6F5' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: '#EEF2FF' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="3" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <circle cx="12" cy="14" r="2" />
                </svg>
              </div>
              <h3 className="font-black text-lg mb-2" style={{ color: '#1E1B4B' }}>分身AIを作りましょう</h3>
              <p className="text-sm mb-6" style={{ color: '#9896B8' }}>
                約10分のヒアリングで、あなたらしく話すAIが完成。<br />
                QRコードを渡すだけで、24時間対応が始まります
              </p>
              <Link href="/setup" className="btn-primary text-sm px-7 py-3" style={{ borderRadius: 14 }}>
                分身AIを作り始める →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cards.map(card => {
                const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/card/${card.id}`
                return (
                  <div
                    key={card.id}
                    className="rounded-2xl overflow-hidden group"
                    style={{ background: 'white', border: '1px solid #E8E6F5', boxShadow: '0 1px 3px rgba(99,102,241,0.06)' }}
                  >
                    {/* Card header gradient */}
                    <div
                      className="h-24 relative"
                      style={{ background: 'linear-gradient(135deg, #3730A3 0%, #5B21B6 50%, #7C3AED 100%)' }}
                    >
                      <div className="absolute inset-0 flex items-end px-5 pb-0">
                        <div
                          className="translate-y-1/2 rounded-2xl overflow-hidden shadow-md"
                          style={{ border: '3px solid white' }}
                        >
                          <Avatar name={card.full_name} size={56} gradient />
                        </div>
                      </div>
                    </div>

                    <div className="pt-10 px-5 pb-3">
                      <h3 className="font-black text-base" style={{ color: '#1E1B4B' }}>{card.full_name}</h3>
                      {card.title && <p className="text-sm font-medium mt-0.5" style={{ color: '#6366F1' }}>{card.title}</p>}
                      {card.company && <p className="text-xs mt-0.5" style={{ color: '#9896B8' }}>{card.company}</p>}
                    </div>

                    {/* QR + actions */}
                    <div className="px-5 pb-5 flex items-center gap-4">
                      {qrDataUrls[card.id] && (
                        <button
                          onClick={() => setQrModal({ url: qrDataUrls[card.id], cardUrl, name: card.full_name })}
                          className="p-2 rounded-xl flex-shrink-0 block transition hover:opacity-80 active:scale-95 relative"
                          style={{ background: '#F4F3FA', border: 'none', cursor: 'pointer' }}
                          title="タップして拡大"
                        >
                          <img src={qrDataUrls[card.id]} alt="QR" className="w-14 h-14 rounded-lg" />
                          <span style={{
                            position: 'absolute', bottom: 4, right: 4,
                            background: 'rgba(99,102,241,0.85)', borderRadius: 4,
                            padding: '1px 4px', fontSize: 8, color: 'white', fontWeight: 700,
                            lineHeight: 1.4,
                          }}>拡大</span>
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: '#9896B8' }}>QRスキャン後にお客様が見る画面 ↓</p>
                        <div className="mb-1.5" />
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={cardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary text-xs px-4 py-2"
                            style={{ borderRadius: 10 }}
                          >
                            お客様が見る画面を確認
                          </a>
                          <Link
                            href={`/print/${card.id}`}
                            className="btn-ghost text-xs px-4 py-2"
                            style={{ borderRadius: 10 }}
                          >
                            印刷用
                          </Link>
                          <button
                            onClick={() => setDeleteConfirm({ id: card.id, name: card.full_name })}
                            className="text-xs px-3 py-2 rounded-xl transition hover:bg-red-50"
                            style={{ color: '#EF4444', background: 'transparent', border: '1px solid #FECACA', cursor: 'pointer' }}
                          >
                            削除
                          </button>
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
            <div className="mb-5">
              <p className="section-label mb-1">顧客管理</p>
              <h2 className="text-lg font-black" style={{ color: '#1E1B4B' }}>AIが受けた相談</h2>
            </div>

            {/* お客様フロー説明 */}
            <div
              className="mb-4 px-4 py-3 rounded-2xl"
              style={{ background: 'white', border: '1px solid #E8E6F5' }}
            >
              <p className="text-xs font-bold mb-2.5" style={{ color: '#9896B8' }}>お客様の流れ</p>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: 'QRスキャン', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
                  { label: 'AIと会話中', color: '#818CF8', bg: 'rgba(99,102,241,0.08)' },
                  { label: 'まとめ確認中', color: '#34D399', bg: 'rgba(52,211,153,0.08)' },
                  { label: 'チャット希望', color: '#A78BFA', bg: 'rgba(167,139,250,0.08)' },
                ].map((s, i) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                    {i < 3 && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4C2D8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sessions.map(session => {
                const st = statusConfig[session.status] || statusConfig.ai_chat
                const name = session.customer_name || '名無し'
                const needsAttention = session.status === 'summarized' || session.status === 'owner_chat'
                return (
                  <div
                    key={session.id}
                    className="px-4 py-4 flex items-center gap-4 rounded-2xl transition-shadow hover:shadow-md"
                    style={{
                      background: needsAttention ? '#FDFAFF' : 'white',
                      border: '1px solid #E8E6F5',
                      borderLeft: needsAttention ? '3px solid #7C3AED' : '1px solid #E8E6F5',
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar name={name} size={40} />
                      {needsAttention && (
                        <span style={{
                          position: 'absolute', top: -2, right: -2,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#7C3AED', border: '2px solid white',
                          animation: 'pulse 1.5s infinite',
                          display: 'block',
                        }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1E1B4B' }}>{name}</p>
                        <span
                          className="badge text-xs flex-shrink-0"
                          style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 9999, fontSize: '0.7rem', fontWeight: 700 }}
                        >
                          {st.label}
                        </span>
                        {needsAttention && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: '#7C3AED',
                            background: '#EDE9FE', borderRadius: 6, padding: '2px 6px',
                          }}>
                            あなたを待っています
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: '#9896B8' }}>
                        {new Date(session.updated_at).toLocaleDateString('ja-JP', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {(session.status === 'summarized' || session.status === 'owner_chat') ? (
                        <>
                          <Link
                            href={`/summary/${session.id}`}
                            className="btn-ghost text-xs px-3 py-1.5"
                            style={{ borderRadius: 10 }}
                          >
                            まとめ
                          </Link>
                          <Link
                            href={`/owner/chat/${session.id}`}
                            className="btn-primary text-xs px-3 py-1.5"
                            style={{ borderRadius: 10 }}
                          >
                            チャット
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={`/chat/${session.id}?view=1`}
                          className="btn-ghost text-xs px-3 py-1.5"
                          style={{ borderRadius: 10 }}
                        >
                          確認
                        </Link>
                      )}
                      <button
                        onClick={() => setDeleteSessionConfirm({ id: session.id, name })}
                        className="text-xs px-3 py-1.5 rounded-xl transition hover:bg-red-50"
                        style={{
                          color: '#EF4444', background: 'transparent',
                          border: '1px solid #FECACA', cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        削除
                      </button>
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
