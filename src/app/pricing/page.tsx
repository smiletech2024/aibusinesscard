'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PLAN_COLORS, type PlanId } from '@/lib/plans'
import { formatTokens } from '@/lib/credits'
import Link from 'next/link'

type PlanInfo = {
  plan: PlanId
  planName: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  subBalance: number
  purchasedBalance: number
  totalBalance: number
  cardCount: number
  personaCount: number
  maxCards: number
  maxPersonas: number
  monthlyTokens: number
}

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const DASH = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

function PricingContent() {
  const router     = useRouter()
  const searchParams = useSearchParams()
  const supabase   = createClient()

  const [planInfo, setPlanInfo]       = useState<PlanInfo | null>(null)
  const [loading, setLoading]         = useState(true)
  const [processing, setProcessing]   = useState<string | null>(null)

  const successPlan = searchParams.get('success') === '1' ? searchParams.get('plan') : null
  const cancelled   = searchParams.get('cancel') === '1'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    try {
      const res = await fetch('/api/plan')
      if (res.ok) setPlanInfo(await res.json())
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => { load() }, [load])

  const handleSubscribe = async (planId: PlanId) => {
    setProcessing(planId)
    try {
      const res  = await fetch('/api/stripe/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const json = await res.json()
      if (json.url)              window.location.href = json.url
      else if (json.redirect === 'portal') handlePortal()
      else { alert('決済ページの作成に失敗しました。'); setProcessing(null) }
    } catch { alert('通信エラーが発生しました。'); setProcessing(null) }
  }

  const handlePortal = async () => {
    setProcessing('portal')
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else { alert('ポータルを開けませんでした。'); setProcessing(null) }
    } catch { alert('通信エラー'); setProcessing(null) }
  }

  const currentPlan = planInfo?.plan ?? 'free'

  const planOrder: PlanId[] = ['free', 'solo', 'growth', 'scale']

  const featureRows = [
    { label: 'AI名刺枚数',        key: 'cards'   as const },
    { label: '分身AIペルソナ',     key: 'personas' as const },
    { label: '月間トークン',       key: 'tokens'  as const },
    { label: 'セッション分析',     key: 'sessionAnalysis'   as const },
    { label: 'Push通知',          key: 'push'    as const },
    { label: '月次レポート',       key: 'report'  as const },
    { label: '優先サポート',       key: 'support' as const },
  ]

  function featureValue(planId: PlanId, key: string) {
    const p = PLANS[planId]
    switch (key) {
      case 'cards':   return p.maxCards   === -1 ? '無制限' : `${p.maxCards}枚`
      case 'personas': return p.maxPersonas === -1 ? '無制限' : `${p.maxPersonas}個`
      case 'tokens':  return p.monthlyTokens === 0 ? '初回15万のみ' : `${formatTokens(p.monthlyTokens)}/月`
      case 'sessionAnalysis': return p.features.sessionAnalysis   ? 'ok' : 'no'
      case 'push':    return p.features.pushNotifications ? 'ok' : 'no'
      case 'report':  return p.features.monthlyReport  ? 'ok' : 'no'
      case 'support': return p.features.prioritySupport ? 'ok' : 'no'
      default: return '—'
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0', paddingBottom: 60 }}>

      {/* ヘッダー */}
      <div style={{ background: 'linear-gradient(135deg,#C4511A,#F26722)', padding: '24px 20px 32px', color: '#fff' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            ← ダッシュボード
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>プランを選択</h1>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 0' }}>いつでもアップグレード・ダウングレード可能</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px' }}>

        {/* バナー */}
        {successPlan && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: '12px 16px', marginTop: 20, color: '#065F46', fontWeight: 600, fontSize: 14 }}>
            🎉 {successPlan.toUpperCase()}プランへの変更が完了しました！
          </div>
        )}
        {cancelled && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 16px', marginTop: 20, color: '#92400E', fontSize: 14 }}>
            決済がキャンセルされました。
          </div>
        )}

        {/* 現在のプラン */}
        {!loading && planInfo && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDD9C8', padding: '16px 20px', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#A08068', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>現在のプラン</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: PLAN_COLORS[currentPlan].text }}>{PLANS[currentPlan].name}</span>
                {planInfo.cancelAtPeriodEnd && (
                  <span style={{ fontSize: 11, background: '#FEF2F2', color: '#EF4444', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                    {planInfo.currentPeriodEnd ? `${new Date(planInfo.currentPeriodEnd).toLocaleDateString('ja-JP')}で終了` : 'キャンセル済み'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#A08068', marginTop: 4 }}>
                月次トークン: {formatTokens(planInfo.subBalance)} | 購入済み: {formatTokens(planInfo.purchasedBalance)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {currentPlan !== 'free' && (
                <button
                  onClick={handlePortal}
                  disabled={!!processing}
                  style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, background: '#FAF5F0', color: '#F26722', border: '1.5px solid #F26722', cursor: 'pointer', opacity: processing ? 0.6 : 1 }}
                >
                  {processing === 'portal' ? '…' : '請求管理'}
                </button>
              )}
              <Link href="/credits" style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, background: 'rgba(242,103,34,0.08)', color: '#F26722', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                トークン購入
              </Link>
            </div>
          </div>
        )}

        {/* プランカード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 24 }}>
          {planOrder.map(planId => {
            const p         = PLANS[planId]
            const isCurrent = planId === currentPlan
            const colors    = PLAN_COLORS[planId]
            const isUpgrade = planOrder.indexOf(planId) > planOrder.indexOf(currentPlan)
            const isDowngrade = planOrder.indexOf(planId) < planOrder.indexOf(currentPlan)

            return (
              <div
                key={planId}
                style={{
                  background: '#fff',
                  border: isCurrent ? `2px solid ${colors.border}` : '1px solid #EDD9C8',
                  borderRadius: 20,
                  padding: '20px 16px 16px',
                  position: 'relative',
                  boxShadow: isCurrent ? `0 4px 20px ${colors.bg}` : '0 2px 8px rgba(242,103,34,0.04)',
                }}
              >
                {p.badge && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#F26722,#F59340)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    {p.badge}
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: -10, right: 12, background: colors.border, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 99 }}>
                    利用中
                  </div>
                )}

                <div style={{ fontSize: 14, fontWeight: 800, color: colors.text, marginBottom: 2 }}>{p.name}</div>
                <div style={{ marginBottom: 14 }}>
                  {p.priceJpy === 0
                    ? <span style={{ fontSize: 24, fontWeight: 800, color: '#1C0F05' }}>無料</span>
                    : <>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#1C0F05' }}>¥{p.priceJpy.toLocaleString('ja-JP')}</span>
                        <span style={{ fontSize: 12, color: '#A08068' }}>/月</span>
                      </>
                  }
                </div>

                {/* 主要スペック */}
                <div style={{ fontSize: 12, color: '#4A2C1A', lineHeight: 2, marginBottom: 14 }}>
                  <div>名刺: <strong>{p.maxCards === -1 ? '無制限' : `${p.maxCards}枚`}</strong></div>
                  <div>ペルソナ: <strong>{p.maxPersonas === -1 ? '無制限' : `${p.maxPersonas}個`}</strong></div>
                  <div>月間トークン: <strong>{p.monthlyTokens === 0 ? '初回15万のみ' : formatTokens(p.monthlyTokens)}</strong></div>
                </div>

                {/* アクションボタン */}
                {isCurrent ? (
                  <div style={{ textAlign: 'center', fontSize: 12, color: colors.text, fontWeight: 700, padding: '8px 0' }}>✓ 現在のプラン</div>
                ) : planId === 'free' ? (
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#A08068', padding: '8px 0' }}>
                    {isDowngrade ? 'ポータルからダウングレード' : ''}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(planId)}
                    disabled={!!processing}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1, border: 'none',
                      background: isUpgrade ? `linear-gradient(135deg,${colors.border},${colors.border}CC)` : '#FAF5F0',
                      color: isUpgrade ? '#fff' : colors.text,
                    }}
                  >
                    {processing === planId ? '処理中…' : isUpgrade ? '変更する' : 'ダウングレード'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 機能比較テーブル */}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1C0F05', margin: '32px 0 14px' }}>機能比較</h2>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDD9C8', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAF5F0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#A08068', borderBottom: '1px solid #EDD9C8' }}>機能</th>
                {planOrder.map(p => (
                  <th key={p} style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: PLAN_COLORS[p].text, borderBottom: '1px solid #EDD9C8' }}>
                    {PLANS[p].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureRows.map(({ label, key }, i) => (
                <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '11px 16px', color: '#4A2C1A', borderBottom: '1px solid #F5E8DC' }}>{label}</td>
                  {planOrder.map(planId => {
                    const val = featureValue(planId, key)
                    const isOk = val === 'ok'
                    const isNo = val === 'no'
                    return (
                      <td key={planId} style={{ padding: '11px 10px', textAlign: 'center', borderBottom: '1px solid #F5E8DC' }}>
                        {isOk ? (
                          <span style={{ color: '#10B981', display: 'inline-flex', justifyContent: 'center' }}>{CHECK}</span>
                        ) : isNo ? (
                          <span style={{ color: '#D1D5DB', display: 'inline-flex', justifyContent: 'center' }}>{DASH}</span>
                        ) : (
                          <span style={{ fontWeight: 600, color: '#1C0F05', fontSize: 12 }}>{val}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 注意事項 */}
        <div style={{ marginTop: 24, fontSize: 12, color: '#A08068', lineHeight: 1.8 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>月次トークンは毎月の更新日にリセットされます（未使用分は翌月に繰り越しません）</li>
            <li>月次トークンが不足した場合は、トークン購入パックで補充できます</li>
            <li>ダウングレードは現在の契約期間終了後に適用されます</li>
            <li>お支払いはStripeの安全な決済ページで行われます</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#FAF5F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #EDD9C8', borderTopColor: '#F26722', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}
