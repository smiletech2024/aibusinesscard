'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { PLANS } from '@/lib/plans'
import { formatTokens, tokensToConversations } from '@/lib/credits'

type Stats = {
  users: { total: number; newThisMonth: number; newLastMonth: number; momGrowthPct: number }
  subscriptions: { byPlan: Record<string, number>; totalPaying: number; mrr: number }
  sessions: { total: number; thisMonth: number; dailyLast30: { day: string; count: number }[] }
  activeUsers30d: number
  tokens: { totalConsumed: number; totalPurchased: number; totalSubBalance: number; totalPaidBalance: number }
  cards: number
  personas: number
  unreadFeedback: number
  recentSignups: { id: string; email: string; full_name: string | null; created_at: string }[]
  matching: { needsCount: number; skillsCount: number; matchesCount: number }
}

type Feedback = {
  id: string; category: string; body: string; is_read: boolean
  admin_note: string | null; created_at: string
  profiles: { email: string; full_name: string | null } | null
}

type SupportMsg = { id?: string; role: 'user' | 'assistant' | 'operator'; content: string; created_at?: string }
type SupportSession = {
  session_key: string
  created_at: string
  updated_at: string
  escalated: boolean
  escalated_at?: string
  operator_active: boolean
  messages: SupportMsg[]
  customer_name?: string
  meeting_context?: string
}

const PLAN_LABELS: Record<string, string> = { free: 'フリー', solo: 'スタンダード', growth: 'ビジネス', scale: 'エンタープライズ' }
const PLAN_COLORS: Record<string, string> = { free: '#6B7280', solo: '#F26722', growth: '#7C3AED', scale: '#F59E0B' }
const CAT_LABELS: Record<string, string> = { general: '💬 意見', feature: '✨ 機能要望', bug: '🐛 不具合' }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

function KpiCard({ label, value, sub, color, alert }: { label: string; value: string | number; sub?: string; color?: string; alert?: boolean }) {
  return (
    <div style={{
      background: alert ? '#FEF2F2' : '#fff',
      borderRadius: 16,
      border: `1.5px solid ${alert ? '#FECACA' : '#EDD9C8'}`,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color ?? (alert ? '#DC2626' : '#1C0F05'), lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#A08068', marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )
}

function Sparkline({ data }: { data: { day: string; count: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const w = 120, h = 32
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (d.count / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#F26722" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── サポートBOT管理パネル ──────────────────────────────────────
function SupportBotPanel() {
  const isMobile = useIsMobile()
  const [sessions, setSessions]       = useState<SupportSession[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const bottomRef                     = useRef<HTMLDivElement>(null)
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/admin/support-sessions')
    if (res.ok) {
      const { sessions: data } = await res.json()
      setSessions(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSessions()
    pollRef.current = setInterval(loadSessions, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedKey, sessions])

  const sendOperator = async () => {
    if (!selectedKey || !input.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/admin/support-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_key: selectedKey, content: input.trim() }),
      })
      setInput('')
      await loadSessions()
    } finally {
      setSending(false)
    }
  }

  const endOperator = async () => {
    if (!selectedKey) return
    await fetch('/api/admin/support-sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_key: selectedKey }),
    })
    await loadSessions()
  }

  const selected = sessions.find(s => s.session_key === selectedKey)

  const roleLabel = (role: string) => {
    if (role === 'user')      return { label: 'ユーザー', color: '#F26722' }
    if (role === 'operator')  return { label: '💼 運営', color: '#3B82F6' }
    return { label: '👩 香里', color: '#10B981' }
  }

  const shortKey = (key: string) => key.slice(0, 8) + '…'
  const lastMsg  = (s: SupportSession) => s.messages[s.messages.length - 1]
  const escalatedCount = sessions.filter(s => s.escalated).length

  // モバイル：詳細表示中はリストを隠す
  const showList   = !isMobile || !selectedKey
  const showDetail = !!selectedKey

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: (!isMobile && selected) ? '300px 1fr' : '1fr',
      gap: 10,
      minHeight: 500,
    }}>
      {/* セッション一覧 */}
      {showList && (
        <div style={{ background: '#1E293B', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>チャット履歴</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, color: '#64748B' }}>{sessions.length}件</div>
              {escalatedCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: '#EF4444', color: '#fff', padding: '2px 7px', borderRadius: 99 }}>
                  🆘 {escalatedCount}件
                </span>
              )}
            </div>
          </div>
          {loading && <div style={{ padding: 20, color: '#64748B', fontSize: 12 }}>読み込み中…</div>}
          {!loading && sessions.length === 0 && (
            <div style={{ padding: 20, color: '#64748B', fontSize: 12, textAlign: 'center' }}>
              まだチャット履歴がありません
            </div>
          )}
          <div style={{ maxHeight: isMobile ? 'calc(100vh - 200px)' : 520, overflowY: 'auto' }}>
            {sessions.map(s => {
              const last = lastMsg(s)
              const isSelected = s.session_key === selectedKey
              return (
                <div key={s.session_key}
                  onClick={() => setSelectedKey(isSelected ? null : s.session_key)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #263147',
                    cursor: 'pointer',
                    background: isSelected ? '#263147' : 'transparent',
                    borderLeft: isSelected ? '3px solid #F26722' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.customer_name ? '#F1F5F9' : '#94A3B8', fontFamily: s.customer_name ? 'inherit' : 'monospace' }}>
                        {s.customer_name || shortKey(s.session_key)}
                      </span>
                      {s.escalated && (
                        <span style={{ fontSize: 9, fontWeight: 800, background: '#EF4444', color: '#fff', padding: '1px 5px', borderRadius: 99 }}>
                          🆘 待ち
                        </span>
                      )}
                      {s.operator_active && (
                        <span style={{ fontSize: 9, fontWeight: 800, background: '#10B981', color: '#fff', padding: '1px 5px', borderRadius: 99 }}>
                          💼 対応中
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>
                      {new Date(s.updated_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {last && (
                    <div style={{ fontSize: 11.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: roleLabel(last.role).color, fontWeight: 700, marginRight: 4 }}>
                        {last.role === 'user' ? 'U:' : last.role === 'operator' ? 'OP:' : 'AI:'}
                      </span>
                      {last.content}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                    {s.messages.length}件のメッセージ
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 会話詳細 */}
      {showDetail && selected && (
        <div style={{
          background: '#1E293B',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // モバイルでは画面全体を使う
          ...(isMobile ? { position: 'fixed', inset: 0, zIndex: 100, borderRadius: 0 } : {}),
        }}>
          {/* ヘッダー */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setSelectedKey(null)}
                style={{ background: '#334155', color: '#94A3B8', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>
                ←
              </button>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>会話詳細</div>
                <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>{selected.session_key.slice(0, 16)}…</div>
              </div>
            </div>
            {selected.operator_active && (
              <button onClick={endOperator}
                style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                対応終了
              </button>
            )}
          </div>

          {/* 接点カード */}
          {(selected.customer_name || selected.meeting_context) && (
            <div style={{ padding: '10px 14px', background: '#0F172A', borderBottom: '1px solid #334155', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 22 }}>👤</div>
              <div>
                {selected.customer_name && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{selected.customer_name}</div>
                )}
                {selected.meeting_context && (
                  <div style={{ fontSize: 11, color: '#F26722', fontWeight: 600, marginTop: 2 }}>
                    📍 {selected.meeting_context}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* メッセージ一覧 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selected.messages.map((m, i) => {
              const { label, color } = roleLabel(m.role)
              const isUser = m.role === 'user'
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 2 }}>
                  <div style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</div>
                  <div style={{
                    maxWidth: '88%',
                    background: isUser ? '#334155' : m.role === 'operator' ? '#1E3A5F' : '#263147',
                    border: `1px solid ${isUser ? '#475569' : m.role === 'operator' ? '#3B82F6' : '#334155'}`,
                    color: '#E2E8F0',
                    borderRadius: 10,
                    padding: '8px 11px',
                    fontSize: 13,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                  {m.created_at && (
                    <div style={{ fontSize: 9, color: '#475569' }}>
                      {new Date(m.created_at).toLocaleTimeString('ja-JP')}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* 運営メッセージ入力 */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #334155', background: '#0F172A', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: selected.operator_active ? '#3B82F6' : '#64748B', fontWeight: 700, marginBottom: 6 }}>
              {selected.operator_active ? '💼 運営対応中（AIは停止中）' : '💼 運営として割り込む'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOperator() } }}
                placeholder="ユーザーへのメッセージを入力…"
                rows={2}
                style={{
                  flex: 1, resize: 'none',
                  border: '1.5px solid #3B82F6', borderRadius: 8,
                  padding: '8px 10px', fontSize: 14,
                  fontFamily: 'inherit', outline: 'none',
                  lineHeight: 1.5, background: '#1E293B',
                  color: '#E2E8F0',
                }}
              />
              <button
                onClick={sendOperator}
                disabled={!input.trim() || sending}
                style={{
                  background: input.trim() && !sending ? '#3B82F6' : '#334155',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '0 14px', fontSize: 13, fontWeight: 700,
                  cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                {sending ? '…' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── メインページ ───────────────────────────────────────────────
export default function AdminPage() {
  const isMobile = useIsMobile()
  const [stats, setStats]       = useState<Stats | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'kpi' | 'users' | 'feedback' | 'support'>('kpi')

  const load = useCallback(async () => {
    setLoading(true)
    const [sRes, fRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/feedback'),
    ])
    if (sRes.ok) setStats(await sRes.json())
    if (fRes.ok) setFeedback((await fRes.json()).data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    await fetch('/api/admin/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    })
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, is_read: true } : f))
  }

  const pad = isMobile ? '12px' : '24px'
  const gridCols = isMobile
    ? 'repeat(2, 1fr)'
    : 'repeat(auto-fill, minmax(200px, 1fr))'

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F1F5F9' }}>
      {/* ヘッダー */}
      <div style={{
        background: '#1E293B',
        borderBottom: '1px solid #334155',
        padding: isMobile ? '12px 14px' : '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          {!isMobile && <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 2 }}>ADMIN CONSOLE</div>}
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, color: '#F1F5F9' }}>
            {isMobile ? '管理画面' : 'AI名刺 管理画面'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stats?.unreadFeedback ? (
            <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>
              {isMobile ? stats.unreadFeedback : `未読 ${stats.unreadFeedback}件`}
            </span>
          ) : null}
          <button onClick={load}
            style={{ padding: isMobile ? '6px 10px' : '6px 14px', borderRadius: 8, background: '#334155', color: '#94A3B8', fontSize: 12, border: 'none', cursor: 'pointer' }}>
            {isMobile ? '↻' : '更新'}
          </button>
          <Link href="/dashboard"
            style={{ padding: isMobile ? '6px 10px' : '6px 14px', borderRadius: 8, background: '#334155', color: '#94A3B8', fontSize: 12, textDecoration: 'none' }}>
            {isMobile ? '⌂' : '← サービスへ'}
          </Link>
        </div>
      </div>

      {/* タブ */}
      <div style={{
        background: '#1E293B',
        borderBottom: '1px solid #334155',
        padding: '0 8px',
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        {([
          ['kpi',      isMobile ? 'KPI' : 'KPI ダッシュボード'],
          ['users',    isMobile ? '登録者' : '最近の登録者'],
          ['feedback', `${isMobile ? '意見箱' : '意見箱'}${stats?.unreadFeedback ? ` (${stats.unreadFeedback})` : ''}`],
          ['support',  isMobile ? '👩 サポート' : '👩 香里サポート'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: isMobile ? '11px 14px' : '12px 16px',
              fontSize: isMobile ? 12 : 13,
              whiteSpace: 'nowrap',
              fontWeight: tab === key ? 800 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === key ? '#F26722' : '#64748B',
              borderBottom: tab === key ? '2px solid #F26722' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: pad, maxWidth: 1200, margin: '0 auto' }}>
        {loading && tab !== 'support' && (
          <div style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>読み込み中…</div>
        )}

        {/* ── KPIダッシュボード ── */}
        {!loading && stats && tab === 'kpi' && (
          <>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>ユーザー</div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10, marginBottom: 20 }}>
              <KpiCard label="総ユーザー数" value={stats.users.total.toLocaleString('ja-JP')} sub="累計登録数" />
              <KpiCard label="今月の新規登録"
                value={stats.users.newThisMonth}
                sub={`先月 ${stats.users.newLastMonth}人`}
                color={stats.users.momGrowthPct >= 0 ? '#10B981' : '#EF4444'}
              />
              <KpiCard label="アクティブユーザー" value={stats.activeUsers30d} sub="過去30日" />
              <KpiCard label="有料ユーザー" value={stats.subscriptions.totalPaying} color="#F26722" />
            </div>

            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>収益</div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10, marginBottom: 20 }}>
              <KpiCard label="MRR" value={`¥${stats.subscriptions.mrr.toLocaleString('ja-JP')}`} sub="月次経常収益" color="#10B981" />
              {(['solo', 'growth', 'scale'] as const).map(plan => (
                <div key={plan} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #EDD9C8', padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, marginBottom: 4 }}>{PLAN_LABELS[plan]}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: PLAN_COLORS[plan], lineHeight: 1 }}>
                    {stats.subscriptions.byPlan[plan] ?? 0}<span style={{ fontSize: 12, color: '#A08068', fontWeight: 400 }}>人</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#A08068', marginTop: 4 }}>
                    ¥{((stats.subscriptions.byPlan[plan] ?? 0) * PLANS[plan].priceJpy).toLocaleString('ja-JP')}/月
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>AI会話</div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10, marginBottom: 20 }}>
              <KpiCard label="累計セッション" value={stats.sessions.total.toLocaleString('ja-JP')} />
              <KpiCard label="今月のセッション" value={stats.sessions.thisMonth.toLocaleString('ja-JP')} />
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #EDD9C8', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, marginBottom: 6 }}>過去30日の推移</div>
                <Sparkline data={stats.sessions.dailyLast30} />
              </div>
              <KpiCard label="アクティブ名刺" value={stats.cards} sub={`ペルソナ ${stats.personas}個`} />
            </div>

            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>トークン</div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10, marginBottom: 20 }}>
              <KpiCard label="累計消費" value={formatTokens(stats.tokens.totalConsumed)} sub={`≈ ${tokensToConversations(stats.tokens.totalConsumed)}会話`} />
              <KpiCard label="累計購入" value={formatTokens(stats.tokens.totalPurchased)} color="#F26722" />
              <KpiCard label="残高合計" value={formatTokens(stats.tokens.totalSubBalance + stats.tokens.totalPaidBalance)} />
              <KpiCard label="未読FBK" value={stats.unreadFeedback} alert={stats.unreadFeedback > 0} />
            </div>

            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>エージェントマッチング</div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10, marginBottom: 20 }}>
              <KpiCard label="課題登録数" value={stats.matching.needsCount.toLocaleString('ja-JP')} sub="有効な課題" color="#7C3AED" />
              <KpiCard label="スキル登録数" value={stats.matching.skillsCount.toLocaleString('ja-JP')} sub="有効なスキル" color="#0EA5E9" />
              <KpiCard label="マッチング数" value={stats.matching.matchesCount.toLocaleString('ja-JP')} sub="累計" color="#F26722" />
            </div>
          </>
        )}

        {/* ── 最近の登録者 ── */}
        {!loading && stats && tab === 'users' && (
          <div style={{ background: '#1E293B', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155', fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
              最近の登録者（直近10名）
            </div>
            {stats.recentSignups.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center',
                padding: isMobile ? '10px 14px' : '12px 20px',
                borderBottom: '1px solid #1E293B',
                background: i % 2 === 0 ? '#1E293B' : '#263147',
                gap: 12,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>
                  {(u.full_name ?? u.email)[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name ?? '—'}</div>
                  <div style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>
                  {new Date(u.created_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 意見箱 ── */}
        {!loading && tab === 'feedback' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {feedback.length === 0 && (
              <div style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>フィードバックはまだありません</div>
            )}
            {feedback.map(f => (
              <div key={f.id} style={{
                background: f.is_read ? '#1E293B' : '#1E3A5F',
                border: `1.5px solid ${f.is_read ? '#334155' : '#3B82F6'}`,
                borderRadius: 14, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: '#334155', color: '#94A3B8', padding: '2px 8px', borderRadius: 99 }}>
                    {CAT_LABELS[f.category] ?? f.category}
                  </span>
                  {!f.is_read && (
                    <span style={{ fontSize: 11, background: '#3B82F6', color: '#fff', fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>NEW</span>
                  )}
                  <span style={{ fontSize: 11, color: '#64748B', marginLeft: 'auto' }}>
                    {new Date(f.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                {!isMobile && (
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
                    {f.profiles?.full_name ?? ''} &lt;{f.profiles?.email}&gt;
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.7, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{f.body}</div>
                {!f.is_read && (
                  <button onClick={() => markRead(f.id)}
                    style={{ padding: '6px 14px', borderRadius: 8, background: '#334155', color: '#94A3B8', fontSize: 12, border: 'none', cursor: 'pointer' }}>
                    既読にする
                  </button>
                )}
                {f.is_read && <span style={{ fontSize: 11, color: '#334155' }}>既読</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── 香里サポートBOT ── */}
        {tab === 'support' && <SupportBotPanel />}
      </div>
    </div>
  )
}
