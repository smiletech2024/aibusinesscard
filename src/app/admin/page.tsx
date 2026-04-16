'use client'

import { useState, useEffect, useCallback } from 'react'
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
}

type Feedback = {
  id: string; category: string; body: string; is_read: boolean
  admin_note: string | null; created_at: string
  profiles: { email: string; full_name: string | null } | null
}

const PLAN_LABELS: Record<string, string> = { free: 'フリー', solo: 'スタンダード', growth: 'ビジネス', scale: 'エンタープライズ' }
const PLAN_COLORS: Record<string, string> = { free: '#6B7280', solo: '#F26722', growth: '#7C3AED', scale: '#F59E0B' }
const CAT_LABELS: Record<string, string> = { general: '💬 意見', feature: '✨ 機能要望', bug: '🐛 不具合' }

function KpiCard({ label, value, sub, color, alert }: { label: string; value: string | number; sub?: string; color?: string; alert?: boolean }) {
  return (
    <div style={{
      background: alert ? '#FEF2F2' : '#fff',
      borderRadius: 16,
      border: `1.5px solid ${alert ? '#FECACA' : '#EDD9C8'}`,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: color ?? (alert ? '#DC2626' : '#1C0F05'), lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#A08068', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ミニスパークライン
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

export default function AdminPage() {
  const [stats, setStats]       = useState<Stats | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'kpi' | 'users' | 'feedback'>('kpi')

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

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', color: '#F1F5F9' }}>
      {/* ヘッダー */}
      <div style={{ background: '#1E293B', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 2 }}>ADMIN CONSOLE</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#F1F5F9' }}>AI名刺 管理画面</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {stats?.unreadFeedback ? (
            <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>
              未読 {stats.unreadFeedback}件
            </span>
          ) : null}
          <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, background: '#334155', color: '#94A3B8', fontSize: 12, border: 'none', cursor: 'pointer' }}>
            更新
          </button>
          <Link href="/dashboard" style={{ padding: '6px 14px', borderRadius: 8, background: '#334155', color: '#94A3B8', fontSize: 12, textDecoration: 'none' }}>
            ← サービスへ
          </Link>
        </div>
      </div>

      {/* タブ */}
      <div style={{ background: '#1E293B', borderBottom: '1px solid #334155', padding: '0 24px', display: 'flex', gap: 4 }}>
        {([['kpi', 'KPI ダッシュボード'], ['users', '最近の登録者'], ['feedback', `意見箱${stats?.unreadFeedback ? ` (${stats.unreadFeedback})` : ''}`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '12px 16px', fontSize: 13, fontWeight: tab === key ? 800 : 400, background: 'none', border: 'none', cursor: 'pointer',
              color: tab === key ? '#F26722' : '#64748B', borderBottom: tab === key ? '2px solid #F26722' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
        {loading && <div style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>読み込み中…</div>}

        {/* ── KPIダッシュボード ── */}
        {!loading && stats && tab === 'kpi' && (
          <>
            {/* 行1: ユーザー */}
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>ユーザー</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard label="総ユーザー数" value={stats.users.total.toLocaleString('ja-JP')} sub="累計登録数" />
              <KpiCard label="今月の新規登録"
                value={stats.users.newThisMonth}
                sub={`先月 ${stats.users.newLastMonth}人 / MoM ${stats.users.momGrowthPct > 0 ? '+' : ''}${stats.users.momGrowthPct}%`}
                color={stats.users.momGrowthPct >= 0 ? '#10B981' : '#EF4444'}
              />
              <KpiCard label="アクティブユーザー" value={stats.activeUsers30d} sub="過去30日以内に会話あり" />
              <KpiCard label="有料ユーザー数" value={stats.subscriptions.totalPaying} sub={`全体の${Math.round(stats.subscriptions.totalPaying / Math.max(stats.users.total, 1) * 100)}%`} color="#F26722" />
            </div>

            {/* 行2: 収益 */}
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>収益</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard label="MRR（月次経常収益）"
                value={`¥${stats.subscriptions.mrr.toLocaleString('ja-JP')}`}
                sub="サブスク合計"
                color="#10B981"
              />
              {(['solo', 'growth', 'scale'] as const).map(plan => (
                <div key={plan} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #EDD9C8', padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, marginBottom: 6 }}>{PLAN_LABELS[plan]}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: PLAN_COLORS[plan], lineHeight: 1 }}>{stats.subscriptions.byPlan[plan] ?? 0}<span style={{ fontSize: 13, color: '#A08068', fontWeight: 400 }}>人</span></div>
                  <div style={{ fontSize: 11, color: '#A08068', marginTop: 6 }}>¥{((stats.subscriptions.byPlan[plan] ?? 0) * PLANS[plan].priceJpy).toLocaleString('ja-JP')}/月</div>
                </div>
              ))}
            </div>

            {/* 行3: セッション */}
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>AI会話</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard label="累計セッション数" value={stats.sessions.total.toLocaleString('ja-JP')} />
              <KpiCard label="今月のセッション数" value={stats.sessions.thisMonth.toLocaleString('ja-JP')} />
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #EDD9C8', padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, marginBottom: 8 }}>過去30日のセッション推移</div>
                <Sparkline data={stats.sessions.dailyLast30} />
              </div>
              <KpiCard label="アクティブ名刺" value={stats.cards} sub={`ペルソナ ${stats.personas}個`} />
            </div>

            {/* 行4: トークン */}
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>トークン</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard label="累計消費トークン" value={formatTokens(stats.tokens.totalConsumed)} sub={`≈ ${tokensToConversations(stats.tokens.totalConsumed)}会話`} />
              <KpiCard label="累計購入トークン" value={formatTokens(stats.tokens.totalPurchased)} sub="チャージ合計" color="#F26722" />
              <KpiCard label="全ユーザー残高合計"
                value={formatTokens(stats.tokens.totalSubBalance + stats.tokens.totalPaidBalance)}
                sub={`サブスク ${formatTokens(stats.tokens.totalSubBalance)} + 購入済 ${formatTokens(stats.tokens.totalPaidBalance)}`}
              />
              <KpiCard label="未読フィードバック"
                value={stats.unreadFeedback}
                sub={stats.unreadFeedback > 0 ? '要確認' : '全件確認済み'}
                alert={stats.unreadFeedback > 0}
              />
            </div>
          </>
        )}

        {/* ── 最近の登録者 ── */}
        {!loading && stats && tab === 'users' && (
          <div style={{ background: '#1E293B', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>
              最近の登録者（直近10名）
            </div>
            {stats.recentSignups.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #1E293B', background: i % 2 === 0 ? '#1E293B' : '#263147', gap: 16 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {feedback.length === 0 && (
              <div style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>フィードバックはまだありません</div>
            )}
            {feedback.map(f => (
              <div key={f.id} style={{
                background: f.is_read ? '#1E293B' : '#1E3A5F',
                border: `1.5px solid ${f.is_read ? '#334155' : '#3B82F6'}`,
                borderRadius: 16, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: '#334155', color: '#94A3B8', padding: '2px 10px', borderRadius: 99 }}>
                    {CAT_LABELS[f.category] ?? f.category}
                  </span>
                  {!f.is_read && (
                    <span style={{ fontSize: 11, background: '#3B82F6', color: '#fff', fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>NEW</span>
                  )}
                  <span style={{ fontSize: 11, color: '#64748B', marginLeft: 'auto' }}>
                    {f.profiles?.full_name ?? ''} &lt;{f.profiles?.email}&gt;
                  </span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    {new Date(f.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#E2E8F0', lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{f.body}</div>
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
      </div>
    </div>
  )
}
