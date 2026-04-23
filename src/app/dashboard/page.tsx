'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard, CustomerSession } from '@/types'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Logo } from '@/components/Logo'
import { formatTokens, tokensToConversations } from '@/lib/credits'
import { PLANS, PLAN_COLORS, type PlanId } from '@/lib/plans'
import SiteFooter from '@/components/SiteFooter'

const statusConfig: Record<string, { label: string; bg: string; color: string; step: number }> = {
  ai_chat:    { label: 'AIと会話中',    bg: 'rgba(242,103,34,0.1)',  color: '#F5A47A', step: 2 },
  summarized: { label: 'まとめ確認中',  bg: 'rgba(52,211,153,0.1)',  color: '#34D399', step: 3 },
  owner_chat: { label: 'チャット希望',  bg: 'rgba(242,103,34,0.1)', color: '#F5C09A', step: 4 },
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
          ? 'linear-gradient(135deg, #F26722 0%, #F59340 100%)'
          : 'linear-gradient(135deg, #D4551A 0%, #D4691E 100%)',
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
  const [creditBalance, setCreditBalance]         = useState<number | null>(null)
  const [currentPlan, setCurrentPlan]             = useState<PlanId>('free')
  const [monthlySessionCount, setMonthlySessionCount] = useState(0)
  const [maxSessions, setMaxSessions]             = useState(-1)
  const [appointments, setAppointments]           = useState<Appointment[]>([])
  const personaIdsRef  = useRef<string[]>([])
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const [userId, setUserId]               = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  type QuickUpdate = { id: string; persona_id: string; content: string; created_at: string }
  const [quickUpdates, setQuickUpdates]       = useState<Record<string, QuickUpdate[]>>({})
  const [quickInput, setQuickInput]           = useState<Record<string, string>>({})
  const [quickSubmitting, setQuickSubmitting] = useState<Record<string, boolean>>({})

  type Analytics = {
    hot: number; warm: number; cold: number
    topInterests: { label: string; count: number }[]
    totalSessions: number; summarizedSessions: number
  }
  const [analytics, setAnalytics] = useState<Analytics | null>(null)

  type Insights = {
    totalSessions: number; thisMonthSessions: number
    topQuestions: { question: string; count: number }[]
    appointmentCount: number; appointmentsThisMonth: number; conversionRate: number
  }
  const [insights, setInsights] = useState<Insights | null>(null)

  type Appointment = {
    id: string; card_id: string; card_name: string
    customer_name: string; customer_email: string | null; customer_phone: string | null
    preferred_date: string | null; preferred_time: string | null
    contactable_time: string | null; message: string | null
    status: string; created_at: string
  }

  useEffect(() => { checkAuth() }, [])
  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAnalytics(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/dashboard/insights')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setInsights(d) })
      .catch(() => {})
  }, [])
  useEffect(() => {
    fetch('/api/appointments')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.appointments) setAppointments(d.appointments) })
      .catch(() => {})
  }, [])
  useEffect(() => {
    fetch('/api/plan')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCreditBalance((d.subBalance ?? 0) + (d.purchasedBalance ?? 0))
          setCurrentPlan(d.plan ?? 'free')
          setMonthlySessionCount(d.monthlySessionCount ?? 0)
          setMaxSessions(d.maxSessionsPerMonth ?? -1)
        }
      })
      .catch(() => {})
  }, [])

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    setUserId(user.id)
    // プロフィール写真を取得
    const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
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
          width: 160, margin: 1, color: { dark: '#1C0F05', light: '#FFFFFF' }
        })
      }
      setQrDataUrls(qrUrls)
    }
    const { data: personasData } = await supabase.from('personas').select('id').eq('user_id', userId)
    if (personasData?.length) {
      const ids = personasData.map(p => p.id)
      personaIdsRef.current = ids

      // クイックアップデート読み込み
      const { data: quData } = await supabase
        .from('quick_updates')
        .select('*')
        .in('persona_id', ids)
        .order('created_at', { ascending: false })
        .limit(50)
      if (quData) {
        const grouped: Record<string, QuickUpdate[]> = {}
        for (const u of quData) {
          if (!grouped[u.persona_id]) grouped[u.persona_id] = []
          grouped[u.persona_id].push(u)
        }
        setQuickUpdates(grouped)
      }

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

  // 通知許可状態を管理
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported' | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifPermission('unsupported')
    } else {
      setNotifPermission(Notification.permission)
    }
  }, [])

  // 通知を許可するボタンのハンドラ
  const enableNotifications = async () => {
    if (!userId || typeof window === 'undefined' || !('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
    if (permission === 'granted') {
      const { subscribePushUser } = await import('@/lib/push')
      await subscribePushUser(userId)
    }
  }

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

  const handleDeleteAppt = async (id: string) => {
    await fetch('/api/appointments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAppointments(prev => prev.filter(a => a.id !== id))
  }

  const handleApptStatus = async (id: string, status: string) => {
    const res = await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setAvatarUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${userId}.jpg`, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${userId}.jpg`)
      const urlWithCache = `${publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: urlWithCache }).eq('id', userId)
      setAvatarUrl(urlWithCache)
    } catch (err) {
      console.error('アバターアップロード失敗:', err)
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleQuickUpdate = async (personaId: string) => {
    const content = (quickInput[personaId] ?? '').trim()
    if (!content) return
    setQuickSubmitting(prev => ({ ...prev, [personaId]: true }))
    try {
      const res = await fetch('/api/quick-update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ personaId, content }),
      })
      if (res.ok) {
        const { update } = await res.json()
        setQuickUpdates(prev => ({
          ...prev,
          [personaId]: [update, ...(prev[personaId] ?? [])],
        }))
        setQuickInput(prev => ({ ...prev, [personaId]: '' }))
      }
    } finally {
      setQuickSubmitting(prev => ({ ...prev, [personaId]: false }))
    }
  }

  const handleDeleteQuickUpdate = async (personaId: string, updateId: string) => {
    await fetch(`/api/quick-update?id=${updateId}`, { method: 'DELETE' })
    setQuickUpdates(prev => ({
      ...prev,
      [personaId]: (prev[personaId] ?? []).filter(u => u.id !== updateId),
    }))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF5F0' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 rounded-full spin mx-auto mb-4"
            style={{ border: '3px solid #EDD9C8', borderTopColor: '#F26722' }} />
          <p className="text-sm" style={{ color: '#A08068' }}>読み込み中...</p>
        </div>
      </div>
    )
  }

  const aiChatCount = sessions.filter(s => s.status === 'ai_chat').length
  const summaryCount = sessions.filter(s => s.status === 'summarized' || s.status === 'owner_chat').length

  return (
    <div style={{ background: '#FAF5F0' }}>

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
            <p style={{ fontSize: 13, fontWeight: 700, color: '#A08068', marginBottom: 4 }}>
              このQRコードを読み取ってください
            </p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#1C0F05', marginBottom: 20 }}>
              {qrModal.name}
            </p>
            <div style={{
              display: 'inline-block', padding: 12, borderRadius: 16,
              background: '#FAF5F0', marginBottom: 20,
            }}>
              <img src={qrModal.url} alt="QR" style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }} />
            </div>
            <p style={{ fontSize: 11, color: '#A08068', marginBottom: 20, wordBreak: 'break-all' }}>
              {qrModal.cardUrl}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={qrModal.cardUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(135deg, #F26722, #F59340)', color: 'white',
                  textDecoration: 'none', display: 'block',
                }}>
                名刺を開く →
              </a>
              <button onClick={() => setQrModal(null)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: '#FAF5F0', color: '#6B7280', border: 'none', cursor: 'pointer',
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
            <p style={{ fontWeight: 900, fontSize: 16, color: '#1C0F05', marginBottom: 8 }}>
              この名刺を削除しますか？
            </p>
            <p style={{ fontSize: 13, color: '#A08068', marginBottom: 6 }}>
              「{deleteConfirm.name}」
            </p>
            <p style={{ fontSize: 12, color: '#A08068', marginBottom: 24, lineHeight: 1.6 }}>
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
                  background: '#FAF5F0', color: '#6B7280', border: 'none', cursor: 'pointer',
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
            <p style={{ fontWeight: 900, fontSize: 16, color: '#1C0F05', marginBottom: 8 }}>
              この会話履歴を削除しますか？
            </p>
            <p style={{ fontSize: 13, color: '#A08068', marginBottom: 6 }}>
              「{deleteSessionConfirm.name}」との会話
            </p>
            <p style={{ fontSize: 12, color: '#A08068', marginBottom: 24, lineHeight: 1.6 }}>
              AI会話・まとめ・チャット履歴をすべて削除します。<br />この操作は取り消せません。
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onTouchEnd={(e) => { e.preventDefault(); if (!deletingSessionId) handleDeleteSession(deleteSessionConfirm.id) }}
                onClick={() => { if (!deletingSessionId) handleDeleteSession(deleteSessionConfirm.id) }}
                disabled={!!deletingSessionId}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: '#EF4444', color: 'white', border: 'none',
                  cursor: deletingSessionId ? 'not-allowed' : 'pointer',
                  opacity: deletingSessionId ? 0.7 : 1,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}
              >
                {deletingSessionId ? '削除中...' : '削除する'}
              </button>
              <button
                onClick={() => setDeleteSessionConfirm(null)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: '#FAF5F0', color: '#6B7280', border: 'none', cursor: 'pointer',
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
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderColor: '#EDD9C8' }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={26} variant="dark" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* プランバッジ */}
            <Link
              href="/pricing"
              style={{
                display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
                padding: '3px 9px', borderRadius: 99,
                background: PLAN_COLORS[currentPlan].bg,
                border: `1.5px solid ${PLAN_COLORS[currentPlan].border}`,
                textDecoration: 'none', fontSize: 11, fontWeight: 800,
                color: PLAN_COLORS[currentPlan].text, flexShrink: 0,
              }}
            >
              {PLANS[currentPlan].name}
            </Link>

            {/* トークン残高バッジ */}
            <Link
              href="/credits"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
                background: creditBalance !== null && creditBalance <= 0
                  ? 'rgba(239,68,68,0.1)'
                  : creditBalance !== null && creditBalance < 30_000
                  ? 'rgba(245,158,11,0.1)'
                  : 'rgba(242,103,34,0.08)',
                border: '1.5px solid',
                borderColor: creditBalance !== null && creditBalance <= 0
                  ? '#EF4444'
                  : creditBalance !== null && creditBalance < 30_000
                  ? '#F59E0B'
                  : '#F26722',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 10 }}>💬</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: creditBalance !== null && creditBalance <= 0 ? '#EF4444'
                  : creditBalance !== null && creditBalance < 30_000 ? '#F59E0B'
                  : '#F26722',
              }}>
                {creditBalance === null
                  ? '…'
                  : creditBalance <= 0
                  ? '0回'
                  : tokensToConversations(creditBalance)}
              </span>
            </Link>

            {/* ログアウト（アイコンのみ） */}
            <button
              onClick={handleLogout}
              title="ログアウト"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: '50%', border: 'none',
                background: 'transparent', cursor: 'pointer', color: '#A08068', fontSize: 16,
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 通知バナー */}
      {notifications.length > 0 && (
        <div className="relative z-10">
          {notifications.map(n => (
            <div
              key={n.id}
              style={{
                background: 'linear-gradient(135deg, #D4551A, #D4691E)',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 4px 24px rgba(242,103,34,0.45)',
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
                  AIが会話を整理済み · すぐに本題から入れます
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/owner/chat/${n.sessionId}`}
                  style={{
                    background: 'white', color: '#F26722', fontWeight: 700,
                    fontSize: 13, padding: '8px 16px', borderRadius: 20,
                    textDecoration: 'none', display: 'block', whiteSpace: 'nowrap',
                  }}
                >
                  今すぐ話す →
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

      {/* フリープランの対話上限バナー */}
      {/* 通知許可バナー */}
      {(notifPermission === 'default' || notifPermission === null) && !loading && (
        <div style={{ background: '#FFF7ED', borderBottom: '1px solid #FED7AA', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#92400E' }}>
            🔔 お客様が話しかけたとき、スマホに通知を受け取れます
          </div>
          <button
            onClick={enableNotifications}
            style={{ fontSize: 12, fontWeight: 700, color: 'white', background: '#F26722', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            通知を受け取る
          </button>
        </div>
      )}
      {notifPermission === 'granted' && (
        <div style={{ background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', padding: '8px 20px', fontSize: 11, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
          ✅ 通知設定済み — お客様が話しかけると通知が届きます
        </div>
      )}

      {maxSessions !== -1 && monthlySessionCount >= maxSessions && (
        <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#991B1B' }}>今月の対話枠が上限に達しました（{maxSessions}件）</div>
              <div style={{ fontSize: 12, color: '#B91C1C' }}>QRを読んだお客様にAIが応答できません。プランを上げてください。</div>
            </div>
          </div>
          <Link href="/pricing" style={{ background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 99, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            対話枠を増やす →
          </Link>
        </div>
      )}
      {maxSessions !== -1 && monthlySessionCount === maxSessions - 1 && (
        <div style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#92400E' }}>
            ⚠️ 今月の対話残り<strong>1件</strong>です（{monthlySessionCount}/{maxSessions}件使用中）
          </div>
          <Link href="/pricing" style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700, textDecoration: 'none' }}>上限を増やす →</Link>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '名刺', value: cards.length, unit: '枚', color: '#F26722', borderColor: '#F26722' },
              { label: '商談中', value: aiChatCount, unit: '件', color: '#F59340', borderColor: '#F59340' },
              { label: '返事待ち', value: summaryCount, unit: '件', color: '#059669', borderColor: '#059669' },
            ].map(({ label, value, unit, color, borderColor }) => (
              <div
                key={label}
                className="p-4 text-center rounded-2xl"
                style={{ background: 'white', border: '1px solid #EDD9C8', borderLeft: `3px solid ${borderColor}`, boxShadow: '0 1px 3px rgba(242,103,34,0.06)' }}
              >
                <div className="text-3xl font-black mb-1" style={{ color }}>{value}</div>
                <div className="text-xs font-medium" style={{ color: '#A08068' }}>{label}</div>
                <div className="text-xs" style={{ color }}>{unit}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── 成果サマリー ── */}
        {insights && (insights.totalSessions > 0 || insights.appointmentCount > 0) && (
          <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #EDD9C8', boxShadow: '0 1px 3px rgba(242,103,34,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-label mb-0.5">あなたの名刺の成果</p>
                <h2 className="text-base font-black" style={{ color: '#1C0F05' }}>成果サマリー</h2>
              </div>
              <span className="text-xs" style={{ color: '#A08068' }}>累計 / 今月</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: '累計相談数', value: insights.totalSessions, sub: `今月 ${insights.thisMonthSessions}件`, color: '#F26722' },
                { label: 'アポ獲得数', value: insights.appointmentCount, sub: `今月 ${insights.appointmentsThisMonth}件`, color: '#059669' },
                { label: 'アポ転換率', value: `${insights.conversionRate}%`, sub: '相談→アポ', color: insights.conversionRate >= 10 ? '#059669' : '#F59340' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="text-center p-3 rounded-xl" style={{ background: '#FAF5F0' }}>
                  <div className="text-2xl font-black" style={{ color }}>{value}</div>
                  <div className="text-xs font-semibold mt-0.5" style={{ color: '#4A2C1A' }}>{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#A08068' }}>{sub}</div>
                </div>
              ))}
            </div>
            {insights.topQuestions.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#A08068' }}>💬 よく聞かれた質問 TOP{insights.topQuestions.length}（過去30日）</p>
                <div className="space-y-2">
                  {insights.topQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: '#FFF7F2' }}>
                      <span className="text-xs font-black flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#F26722', color: 'white', fontSize: 10 }}>{i + 1}</span>
                      <span className="text-xs flex-1" style={{ color: '#1C0F05', lineHeight: 1.5 }}>{q.question}{q.question.length >= 40 ? '…' : ''}</span>
                      {q.count > 1 && <span className="text-xs font-bold flex-shrink-0" style={{ color: '#F26722' }}>{q.count}回</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 顧客関心の可視化（アナリティクス） ── */}
        {analytics && analytics.summarizedSessions > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{ background: 'white', border: '1px solid #EDD9C8', boxShadow: '0 1px 3px rgba(242,103,34,0.06)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="section-label mb-0.5">分析レポート</p>
                <h2 className="text-base font-black" style={{ color: '#1C0F05' }}>顧客インサイト</h2>
              </div>
              <span className="text-xs" style={{ color: '#A08068' }}>直近90日 · {analytics.summarizedSessions}件の会話</span>
            </div>

            {/* 熱量分布 */}
            <div className="mb-4">
              <p className="text-xs font-bold mb-2" style={{ color: '#A08068' }}>商談温度の分布</p>
              {(() => {
                const total = analytics.hot + analytics.warm + analytics.cold || 1
                return (
                  <div>
                    <div className="flex rounded-xl overflow-hidden h-6 mb-2">
                      {analytics.hot > 0 && (
                        <div style={{ width: `${(analytics.hot / total) * 100}%`, background: 'linear-gradient(90deg, #EF4444, #F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>{Math.round((analytics.hot / total) * 100)}%</span>
                        </div>
                      )}
                      {analytics.warm > 0 && (
                        <div style={{ width: `${(analytics.warm / total) * 100}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>{Math.round((analytics.warm / total) * 100)}%</span>
                        </div>
                      )}
                      {analytics.cold > 0 && (
                        <div style={{ width: `${(analytics.cold / total) * 100}%`, background: 'linear-gradient(90deg, #6B7280, #9CA3AF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>{Math.round((analytics.cold / total) * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4">
                      {[
                        { emoji: '🔥', label: '熱い', count: analytics.hot, color: '#EF4444' },
                        { emoji: '🌡', label: 'ぬるい', count: analytics.warm, color: '#F59E0B' },
                        { emoji: '❄️', label: '冷たい', count: analytics.cold, color: '#6B7280' },
                      ].map(({ emoji, label, count, color }) => count > 0 && (
                        <div key={label} className="flex items-center gap-1.5">
                          <span style={{ fontSize: 12 }}>{emoji}</span>
                          <span className="text-xs font-bold" style={{ color }}>{count}件</span>
                          <span className="text-xs" style={{ color: '#A08068' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* 興味キーワード */}
            {analytics.topInterests.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#A08068' }}>お客様が最も関心を持ったトピック</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.topInterests.map(({ label, count }, i) => (
                    <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                      style={{
                        background: i === 0 ? 'rgba(242,103,34,0.12)' : 'rgba(0,0,0,0.04)',
                        border: i === 0 ? '1px solid rgba(242,103,34,0.3)' : '1px solid rgba(0,0,0,0.08)',
                      }}>
                      <span className="text-xs font-bold" style={{ color: i === 0 ? '#F26722' : '#4A2C1A' }}>{label}</span>
                      <span className="text-xs rounded-full px-1.5 font-bold" style={{ background: i === 0 ? '#F26722' : '#A08068', color: 'white', fontSize: 10 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 名刺セクション */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-label mb-1">名刺管理</p>
              <h2 className="text-lg font-black" style={{ color: '#1C0F05' }}>AI名刺</h2>
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
              style={{ background: 'white', border: '1px solid #EDD9C8' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: '#FFF0E8' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F26722" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="3" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <circle cx="12" cy="14" r="2" />
                </svg>
              </div>
              <h3 className="font-black text-lg mb-2" style={{ color: '#1C0F05' }}>最初の分身AIを、作りましょう</h3>
              <p className="text-sm mb-6" style={{ color: '#A08068' }}>
                3分のヒアリングで完成します。<br />
                名刺のQRを渡した瞬間から、AIが24時間対応を始めます。
              </p>
              <Link href="/setup" className="btn-primary text-sm px-7 py-3" style={{ borderRadius: 14 }}>
                はじめての分身AIを作る →
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
                    style={{ background: 'white', border: '1px solid #EDD9C8', boxShadow: '0 1px 3px rgba(242,103,34,0.06)' }}
                  >
                    {/* Card header gradient */}
                    <div
                      className="h-24 relative"
                      style={{ background: 'linear-gradient(135deg, #C4511A 0%, #D4551A 50%, #D4691E 100%)' }}
                    >
                      <div className="absolute inset-0 flex items-end px-5 pb-0">
                        <div
                          className="translate-y-1/2 rounded-2xl overflow-hidden shadow-md"
                          style={{ border: '3px solid white' }}
                        >
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={card.full_name} style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <Avatar name={card.full_name} size={56} gradient />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-10 px-5 pb-3">
                      <h3 className="font-black text-base" style={{ color: '#1C0F05' }}>{card.full_name}</h3>
                      {card.title && <p className="text-sm font-medium mt-0.5" style={{ color: '#F26722' }}>{card.title}</p>}
                      {card.company && <p className="text-xs mt-0.5" style={{ color: '#A08068' }}>{card.company}</p>}

                      {/* 写真登録ボタン */}
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        style={{
                          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                          background: avatarUrl ? 'rgba(242,103,34,0.08)' : 'rgba(242,103,34,0.12)',
                          border: '1.5px solid rgba(242,103,34,0.3)',
                          color: '#F26722', cursor: 'pointer',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        {avatarUploading ? 'アップロード中...' : avatarUrl ? '写真を変更' : '写真を登録'}
                      </button>
                    </div>

                    {/* クイックアップデート */}
                    {card.persona_id && (() => {
                      const pid = card.persona_id as string
                      const updates = quickUpdates[pid] ?? []
                      return (
                        <div className="mx-5 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(242,103,34,0.2)', background: 'rgba(255,248,244,0.8)' }}>
                          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid rgba(242,103,34,0.12)' }}>
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: 13 }}>⚡</span>
                              <span className="text-xs font-bold" style={{ color: '#1C0F05' }}>AIに最新情報を追加</span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: '#A08068' }}>送信するとすぐ会話に反映されます</p>
                          </div>
                          <div className="px-3 pt-2 pb-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={quickInput[pid] ?? ''}
                                onChange={e => setQuickInput(prev => ({ ...prev, [pid]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickUpdate(pid) } }}
                                placeholder="例：今日、○○社に提案して新しい課題を聞いた"
                                style={{
                                  flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 10,
                                  border: '1.5px solid #DEC4AD', background: '#fff', color: '#1C0F05',
                                  outline: 'none', minWidth: 0,
                                }}
                              />
                              <button
                                onClick={() => handleQuickUpdate(pid)}
                                disabled={quickSubmitting[pid] || !(quickInput[pid] ?? '').trim()}
                                style={{
                                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                                  background: (quickSubmitting[pid] || !(quickInput[pid] ?? '').trim()) ? '#F5C09A' : 'linear-gradient(135deg, #F26722, #F59340)',
                                  color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                }}
                              >
                                {quickSubmitting[pid] ? '...' : '送信'}
                              </button>
                            </div>
                            {updates.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {updates.slice(0, 5).map(u => (
                                  <div key={u.id} className="flex items-start gap-2 group">
                                    <span style={{ fontSize: 10, color: '#C4511A', marginTop: 3, flexShrink: 0 }}>●</span>
                                    <span className="text-xs flex-1" style={{ color: '#4A2C1A', lineHeight: 1.5 }}>{u.content}</span>
                                    <span className="text-xs flex-shrink-0" style={{ color: '#C4A882' }}>
                                      {new Date(u.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteQuickUpdate(pid, u.id)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                      style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                                    >✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* QR + actions */}
                    <div className="px-5 pb-5 flex items-center gap-4">
                      {qrDataUrls[card.id] && (
                        <button
                          onClick={() => setQrModal({ url: qrDataUrls[card.id], cardUrl, name: card.full_name })}
                          className="p-2 rounded-xl flex-shrink-0 block transition hover:opacity-80 active:scale-95 relative"
                          style={{ background: '#FAF5F0', border: 'none', cursor: 'pointer' }}
                          title="タップして拡大"
                        >
                          <img src={qrDataUrls[card.id]} alt="QR" className="w-14 h-14 rounded-lg" />
                          <span style={{
                            position: 'absolute', bottom: 4, right: 4,
                            background: 'rgba(242,103,34,0.85)', borderRadius: 4,
                            padding: '1px 4px', fontSize: 8, color: 'white', fontWeight: 700,
                            lineHeight: 1.4,
                          }}>拡大</span>
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: '#A08068' }}>QRスキャン後にお客様が見る画面 ↓</p>
                        <div className="mb-1.5" />
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={cardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary text-xs px-4 py-2"
                            style={{ borderRadius: 10 }}
                          >
                            🤖 AIをテスト
                          </a>
                          <Link
                            href={`/edit/${card.id}`}
                            className="btn-ghost text-xs px-4 py-2"
                            style={{ borderRadius: 10 }}
                          >
                            編集
                          </Link>
                          <Link
                            href={`/edit-persona/${card.id}`}
                            className="text-xs px-4 py-2 rounded-xl font-semibold transition"
                            style={{ background: '#FFF0E8', color: '#C4511A', border: '1.5px solid #FDD5B5' }}
                          >
                            AIを強化
                          </Link>
                          <Link
                            href={`/print/${card.id}`}
                            className="text-xs px-4 py-2 rounded-xl font-semibold transition"
                            style={{ background: '#F0F4FF', color: '#3B5BDB', border: '1.5px solid #C5D0F5' }}
                          >
                            🎨 デザイン・印刷
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

        {/* AIエージェントバナー */}
        {cards.length > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, #E8601C 0%, #C4511A 100%)',
              boxShadow: '0 6px 24px rgba(232,96,28,0.3)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', overflow: 'hidden' }}
              >
                <img src="/interviewer.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>New</span>
                  <h3 className="font-black text-sm" style={{ color: 'white' }}>眠っている間に、案件が届く</h3>
                </div>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  スキルを登録すると、AIが他ユーザーの課題を自動スキャンして<strong style={{ color: 'white' }}>対応できる案件</strong>を届けます。
                </p>
                <Link
                  href="/agent"
                  className="inline-block text-xs font-bold px-4 py-2 rounded-xl transition hover:opacity-90"
                  style={{ background: 'white', color: '#E8601C', textDecoration: 'none' }}
                >
                  案件を探させる →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* バーチャルオフィス バナー */}
        {cards.length > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, #1C0F05 0%, #2C1A08 100%)',
              boxShadow: '0 6px 24px rgba(28,15,5,0.35)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(232,96,28,0.2)', border: '1px solid rgba(232,96,28,0.3)' }}
              >
                <span style={{ fontSize: 24 }}>🏢</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1" style={{ background: 'rgba(232,96,28,0.3)', color: '#F5903A', whiteSpace: 'nowrap' }}>先着無料</span>
                  <h3 className="font-black text-sm" style={{ color: 'white' }}>バーチャルオフィスに入居する</h3>
                </div>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  関東・関西の仮想ビルに窓口を構える。名刺を渡さなくても、<strong style={{ color: 'white' }}>相手がその場でAIと話せます。</strong>
                </p>
                <Link
                  href="/virtual-office"
                  className="inline-block text-xs font-bold px-4 py-2 rounded-xl transition hover:opacity-90"
                  style={{ background: '#E8601C', color: 'white', textDecoration: 'none' }}
                >
                  空き状況を見る →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* AIを育てる 機能アピールバナー */}
        {cards.length > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(242,103,34,0.08) 0%, rgba(242,103,34,0.12) 100%)',
              border: '1.5px solid rgba(242,103,34,0.2)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F26722, #F59340)', boxShadow: '0 4px 12px rgba(242,103,34,0.35)' }}
              >
                <span style={{ fontSize: 22 }}>🧠</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1" style={{ background: 'rgba(242,103,34,0.12)', color: '#F26722' }}>New</span>
                  <h3 className="font-black text-sm" style={{ color: '#1C0F05' }}>AIの回答を、あなたの言葉に直す</h3>
                </div>
                <p className="text-xs leading-relaxed mb-3" style={{ color: '#6B7280' }}>
                  AIの回答に「惜しい」と感じたとき、正解を一言添えるだけ。<br />
                  次回から、あなたらしい答え方に変わります。
                </p>
                <a
                  href="#sessions"
                  className="inline-block text-xs font-bold px-4 py-2 rounded-xl transition"
                  style={{
                    background: 'linear-gradient(135deg, #F26722, #F59340)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(242,103,34,0.3)',
                    textDecoration: 'none',
                  }}
                >
                  回答を磨きに行く →
                </a>
              </div>
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(242,103,34,0.15)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#A08068' }}>AIを鍛える3つの方法</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: '📚', title: 'スキル登録', desc: '専門領域をAIに伝える' },
                  { icon: '💼', title: '案件事例', desc: '実績をストーリーで学習' },
                  { icon: '✏️', title: '回答修正', desc: '惜しい回答を直接直す' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="rounded-xl p-2.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(242,103,34,0.1)' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <p className="text-xs font-bold" style={{ color: '#1C0F05' }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#A08068' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── アポイント一覧 ── */}
        {appointments.length > 0 && (
          <div>
            <div className="mb-5">
              <p className="section-label mb-1">顧客管理</p>
              <h2 className="text-lg font-black" style={{ color: '#1C0F05' }}>📅 アポイント依頼</h2>
            </div>
            <div className="space-y-3">
              {appointments.map(appt => {
                const isPending   = appt.status === 'pending'
                const isConfirmed = appt.status === 'confirmed'
                const statusLabel = isPending ? '未確認' : isConfirmed ? '確認済み' : 'キャンセル'
                const statusColor = isPending ? '#F59340' : isConfirmed ? '#34D399' : '#9CA3AF'
                const statusBg    = isPending ? 'rgba(245,163,64,0.1)' : isConfirmed ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.1)'
                return (
                  <div key={appt.id}
                    className="rounded-2xl p-4"
                    style={{
                      background: 'white', border: '1px solid #EDD9C8',
                      borderLeft: isPending ? '3px solid #F59340' : '1px solid #EDD9C8',
                    }}
                  >
                    {/* ヘッダー行 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={appt.customer_name} size={40} gradient />
                        <div>
                          <p className="font-bold text-sm" style={{ color: '#1C0F05' }}>{appt.customer_name}</p>
                          <p className="text-xs" style={{ color: '#A08068' }}>
                            {new Date(appt.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {appt.card_name ? ` · ${appt.card_name}の名刺から` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: statusBg, color: statusColor }}
                      >{statusLabel}</span>
                    </div>

                    {/* 詳細 */}
                    <div className="space-y-1.5 mb-3 text-sm" style={{ color: '#4A2C1A' }}>
                      {appt.preferred_date && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#A08068', fontSize: 12, width: 72, flexShrink: 0 }}>希望日時</span>
                          <span className="font-semibold">{appt.preferred_date}{appt.preferred_time ? ` ${appt.preferred_time}` : ''}</span>
                        </div>
                      )}
                      {appt.customer_email && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#A08068', fontSize: 12, width: 72, flexShrink: 0 }}>メール</span>
                          <a href={`mailto:${appt.customer_email}`} style={{ color: '#F26722', fontSize: 13 }}>{appt.customer_email}</a>
                        </div>
                      )}
                      {appt.customer_phone && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#A08068', fontSize: 12, width: 72, flexShrink: 0 }}>電話</span>
                          <a href={`tel:${appt.customer_phone}`} style={{ color: '#F26722', fontSize: 13 }}>{appt.customer_phone}</a>
                        </div>
                      )}
                      {appt.contactable_time && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#A08068', fontSize: 12, width: 72, flexShrink: 0 }}>連絡可能</span>
                          <span style={{ fontSize: 13, color: '#34D399', fontWeight: 600 }}>📞 {appt.contactable_time}</span>
                        </div>
                      )}
                      {appt.message && (
                        <div className="flex gap-2">
                          <span style={{ color: '#A08068', fontSize: 12, width: 72, flexShrink: 0 }}>用件</span>
                          <span style={{ fontSize: 13, lineHeight: 1.6, color: '#4A2C1A' }}>{appt.message}</span>
                        </div>
                      )}
                    </div>

                    {/* アクションボタン */}
                    <div className="flex gap-2">
                      {isPending && (
                        <>
                          <button onClick={() => handleApptStatus(appt.id, 'confirmed')}
                            className="flex-1 text-xs font-bold py-2 rounded-xl"
                            style={{ background: 'rgba(52,211,153,0.12)', color: '#059669', border: '1px solid rgba(52,211,153,0.3)', cursor: 'pointer' }}
                          >✓ 確認済み</button>
                          <button onClick={() => handleApptStatus(appt.id, 'cancelled')}
                            className="text-xs px-3 py-2 rounded-xl"
                            style={{ background: 'transparent', color: '#9CA3AF', border: '1px solid #EDD9C8', cursor: 'pointer' }}
                          >キャンセル</button>
                        </>
                      )}
                      {isConfirmed && (
                        <p className="flex-1 text-xs" style={{ color: '#34D399', margin: 0, lineHeight: '32px' }}>✓ 確認済み — 連絡してアポを確定しましょう</p>
                      )}
                      {/* 削除ボタン（常に表示） */}
                      <button
                        onClick={() => handleDeleteAppt(appt.id)}
                        className="text-xs px-3 py-2 rounded-xl transition hover:bg-red-50"
                        style={{ background: 'transparent', color: '#EF4444', border: '1px solid #FECACA', cursor: 'pointer', flexShrink: 0 }}
                      >削除</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* セッション一覧 */}
        {sessions.length > 0 && (
          <div id="sessions">
            <div className="mb-5">
              <p className="section-label mb-1">顧客管理</p>
              <h2 className="text-lg font-black" style={{ color: '#1C0F05' }}>AIが受けた相談</h2>
            </div>

            {/* お客様フロー説明 */}
            <div
              className="mb-4 px-4 py-3 rounded-2xl"
              style={{ background: 'white', border: '1px solid #EDD9C8' }}
            >
              <p className="text-xs font-bold mb-2.5" style={{ color: '#A08068' }}>お客様の流れ</p>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: 'QRスキャン', color: '#F26722', bg: 'rgba(242,103,34,0.08)' },
                  { label: 'AIと会話中', color: '#F5A47A', bg: 'rgba(242,103,34,0.08)' },
                  { label: 'まとめ確認中', color: '#34D399', bg: 'rgba(52,211,153,0.08)' },
                  { label: 'チャット希望', color: '#F5C09A', bg: 'rgba(242,103,34,0.08)' },
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
                      border: '1px solid #EDD9C8',
                      borderLeft: needsAttention ? '3px solid #D4691E' : '1px solid #EDD9C8',
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar name={name} size={40} />
                      {needsAttention && (
                        <span style={{
                          position: 'absolute', top: -2, right: -2,
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#D4691E', border: '2px solid white',
                          animation: 'pulse 1.5s infinite',
                          display: 'block',
                        }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1C0F05' }}>{name}</p>
                        <span
                          className="badge text-xs flex-shrink-0"
                          style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 9999, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {st.label}
                        </span>
                      </div>
                      {needsAttention && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4691E', marginBottom: 2 }}>
                          ● あなたを待っています
                        </p>
                      )}
                      <p className="text-xs" style={{ color: '#A08068' }}>
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
                          href={`/owner/chat/${session.id}`}
                          className="btn-ghost text-xs px-3 py-1.5"
                          style={{ borderRadius: 10 }}
                        >
                          💬 会話を見る
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
      <SiteFooter />
    </div>
  )
}
