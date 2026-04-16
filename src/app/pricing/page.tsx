'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PLAN_COLORS, TOKEN_RATE_TABLE, type PlanId } from '@/lib/plans'
import { formatTokens } from '@/lib/credits'
import Link from 'next/link'

type PlanInfo = {
  plan: PlanId; planName: string; status: string
  cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null
  subBalance: number; purchasedBalance: number; totalBalance: number
  cardCount: number; personaCount: number
  monthlySessionCount: number; maxSessionsPerMonth: number
}

const CHECK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const DASH  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
const LOCK  = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

function PricingContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [planInfo, setPlanInfo]     = useState<PlanInfo | null>(null)
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const successPlan = searchParams.get('success') === '1' ? searchParams.get('plan') : null
  const cancelled   = searchParams.get('cancel')  === '1'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const res = await fetch('/api/plan')
    if (res.ok) setPlanInfo(await res.json())
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { load() }, [load])

  const handleSubscribe = async (planId: PlanId) => {
    setProcessing(planId)
    const res  = await fetch('/api/stripe/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    const json = await res.json()
    if (json.url)              { window.location.href = json.url; return }
    if (json.redirect === 'portal') { handlePortal(); return }
    alert('決済ページの作成に失敗しました。')
    setProcessing(null)
  }

  const handlePortal = async () => {
    setProcessing('portal')
    const res  = await fetch('/api/stripe/portal', { method: 'POST' })
    const json = await res.json()
    if (json.url) { window.location.href = json.url; return }
    alert('ポータルを開けませんでした。')
    setProcessing(null)
  }

  const currentPlan = planInfo?.plan ?? 'free'
  const planOrder: PlanId[] = ['free', 'solo', 'growth', 'scale']

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0', paddingBottom: 80 }}>

      {/* ヘッダー */}
      <div style={{ background: 'linear-gradient(135deg,#C4511A,#F26722)', padding: '24px 20px 40px', color: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            ← ダッシュボード
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>プランを選択</h1>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '6px 0 0' }}>
            月額サブスクがトークンを最も安く使える方法です
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>

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

        {/* 現在のプランステータス */}
        {!loading && planInfo && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDD9C8', padding: '16px 20px', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#A08068', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>現在のプラン</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: PLAN_COLORS[currentPlan].text }}>{PLANS[currentPlan].name}</span>
                {planInfo.cancelAtPeriodEnd && planInfo.currentPeriodEnd && (
                  <span style={{ fontSize: 11, background: '#FEF2F2', color: '#EF4444', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                    {new Date(planInfo.currentPeriodEnd).toLocaleDateString('ja-JP')}で終了
                  </span>
                )}
              </div>
              {currentPlan === 'free' && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#A08068' }}>
                  今月のAI対話: <strong style={{ color: planInfo.monthlySessionCount >= 5 ? '#EF4444' : '#1C0F05' }}>{planInfo.monthlySessionCount}/5件</strong>
                  {planInfo.monthlySessionCount >= 5 && <span style={{ color: '#EF4444', marginLeft: 6 }}>上限に達しています</span>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {currentPlan !== 'free' && (
                <button onClick={handlePortal} disabled={!!processing}
                  style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, background: '#FAF5F0', color: '#F26722', border: '1.5px solid #F26722', cursor: 'pointer', opacity: processing ? 0.6 : 1 }}>
                  {processing === 'portal' ? '…' : '請求管理'}
                </button>
              )}
              <Link href="/credits" style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, background: 'rgba(242,103,34,0.08)', color: '#F26722', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                トークン補充
              </Link>
            </div>
          </div>
        )}

        {/* ── C: 安心保証のメッセージ ── */}
        <div style={{ background: 'linear-gradient(135deg,#1C0F05,#2D1A0E)', borderRadius: 16, padding: '16px 20px', marginTop: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>🛡️</div>
          <div>
            <div style={{ color: '#FFF0E8', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>サブスクは「AIが止まらない」保証です</div>
            <div style={{ color: '#A08068', fontSize: 12, lineHeight: 1.7 }}>
              大事な商談相手が名刺をスキャンしたとき、トークン切れでAIが無反応では機会損失。
              月額プランなら毎月自動でトークンが補充され、分身AIが常時稼働します。
            </div>
          </div>
        </div>

        {/* プランカード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 24 }}>
          {planOrder.map(planId => {
            const p         = PLANS[planId]
            const isCurrent = planId === currentPlan
            const colors    = PLAN_COLORS[planId]
            const isUpgrade = planOrder.indexOf(planId) > planOrder.indexOf(currentPlan)

            return (
              <div key={planId} style={{
                background: '#fff',
                border: isCurrent ? `2px solid ${colors.border}` : '1px solid #EDD9C8',
                borderRadius: 20, padding: '20px 16px 16px',
                position: 'relative',
                boxShadow: p.badge ? '0 4px 24px rgba(242,103,34,0.12)' : '0 2px 8px rgba(242,103,34,0.04)',
              }}>
                {p.badge && !isCurrent && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#F26722,#F59340)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    {p.badge}
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: -10, right: 14, background: colors.border, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 99 }}>
                    利用中
                  </div>
                )}

                <div style={{ fontSize: 13, fontWeight: 800, color: colors.text, marginBottom: 8 }}>{p.name}</div>

                <div style={{ marginBottom: 12 }}>
                  {p.priceJpy === 0
                    ? <span style={{ fontSize: 26, fontWeight: 900, color: '#1C0F05' }}>無料</span>
                    : <>
                        <span style={{ fontSize: 26, fontWeight: 900, color: '#1C0F05' }}>¥{p.priceJpy.toLocaleString('ja-JP')}</span>
                        <span style={{ fontSize: 11, color: '#A08068' }}>/月</span>
                      </>
                  }
                </div>

                <div style={{ fontSize: 11.5, color: '#4A2C1A', lineHeight: 2, borderTop: '1px solid #F5E8DC', paddingTop: 10, marginBottom: 12 }}>
                  <div>名刺 {p.maxCards === -1 ? '無制限' : `${p.maxCards}枚`}</div>
                  <div>月間対話 {p.maxSessionsPerMonth === -1 ? '無制限' : `${p.maxSessionsPerMonth}件`}</div>
                  <div>月間トークン <strong>{p.monthlyTokens === 0 ? '初回15万' : formatTokens(p.monthlyTokens)}</strong></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: p.showBranding ? '#9CA3AF' : '#10B981' }}>
                      {p.showBranding ? LOCK : CHECK}
                    </span>
                    <span style={{ color: p.showBranding ? '#9CA3AF' : '#4A2C1A' }}>
                      {p.showBranding ? 'ブランド表示あり' : 'ブランド非表示'}
                    </span>
                  </div>
                </div>

                {isCurrent ? (
                  <div style={{ textAlign: 'center', fontSize: 12, color: colors.text, fontWeight: 700, padding: '8px 0' }}>✓ 現在のプラン</div>
                ) : planId === 'free' ? (
                  <div style={{ fontSize: 11, color: '#A08068', textAlign: 'center', padding: '8px 0' }}>ポータルからダウングレード可</div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(planId)}
                    disabled={!!processing}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 99, fontSize: 13, fontWeight: 700,
                      cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.6 : 1, border: 'none',
                      background: isUpgrade ? `${colors.border}` : '#FAF5F0',
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

        {/* ── A: フリープランの制限を明示 ── */}
        <div style={{ background: '#FFF0E8', borderRadius: 14, padding: '14px 18px', marginTop: 20, border: '1px solid #F5D5BE' }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#C4511A', marginBottom: 8 }}>⚠️ フリープランの制限</div>
          <div style={{ fontSize: 12, color: '#4A2C1A', lineHeight: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>• 月5件を超えるとAI対話が停止</div>
            <div>• Push通知なし（対話に気づけない）</div>
            <div>• 分析は直近3件のみ</div>
            <div>• チャット画面に「Powered by AI名刺」表示</div>
          </div>
        </div>

        {/* ── B: トークン単価比較 ── */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', margin: '28px 0 12px' }}>
          📊 トークン単価比較（サブスクが最安）
        </h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDD9C8', overflow: 'hidden' }}>
          {TOKEN_RATE_TABLE.map((row, i) => {
            const isSub = row.label.includes('¥') && !row.label.includes('パック')
            const isMin = i === 0
            const barWidth = (TOKEN_RATE_TABLE[TOKEN_RATE_TABLE.length - 1].rate / row.rate) * 100
            return (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < TOKEN_RATE_TABLE.length - 1 ? '1px solid #F5E8DC' : 'none', background: isSub ? '#FFFBF8' : '#fff' }}>
                <div style={{ width: 110, fontSize: 12, fontWeight: isSub ? 700 : 400, color: isSub ? '#F26722' : '#6B7280', flexShrink: 0 }}>
                  {row.label}
                </div>
                <div style={{ flex: 1, height: 8, background: '#F5E8DC', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barWidth}%`, background: isSub ? 'linear-gradient(90deg,#F26722,#F59340)' : '#D1D5DB', borderRadius: 99, transition: 'width 0.5s' }} />
                </div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 11.5, fontWeight: isSub ? 800 : 400, color: isSub ? '#F26722' : '#6B7280', flexShrink: 0 }}>
                  ¥{(row.rate * 1000).toFixed(4)}/1K
                </div>
                {isSub && <span style={{ fontSize: 10, background: '#FFF0E8', color: '#F26722', padding: '1px 6px', borderRadius: 99, fontWeight: 800, flexShrink: 0 }}>サブスク</span>}
              </div>
            )
          })}
        </div>

        {/* 機能比較テーブル */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', margin: '28px 0 12px' }}>機能比較</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDD9C8', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#FAF5F0' }}>
                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#A08068', borderBottom: '1px solid #EDD9C8' }}>機能</th>
                {planOrder.map(p => (
                  <th key={p} style={{ padding: '11px 8px', textAlign: 'center', fontWeight: 800, color: PLAN_COLORS[p].text, borderBottom: '1px solid #EDD9C8', fontSize: 12 }}>
                    {PLANS[p].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'AI名刺',        val: (p: PlanId) => PLANS[p].maxCards === -1 ? '無制限' : `${PLANS[p].maxCards}枚` },
                { label: 'ペルソナ',       val: (p: PlanId) => PLANS[p].maxPersonas === -1 ? '無制限' : `${PLANS[p].maxPersonas}個` },
                { label: '月間対話',       val: (p: PlanId) => PLANS[p].maxSessionsPerMonth === -1 ? '無制限' : `${PLANS[p].maxSessionsPerMonth}件` },
                { label: '月間トークン',   val: (p: PlanId) => PLANS[p].monthlyTokens === 0 ? '初回のみ' : formatTokens(PLANS[p].monthlyTokens) },
                { label: 'セッション分析', val: (p: PlanId) => PLANS[p].analysisHistoryLimit === -1 ? 'ok' : '3件のみ' },
                { label: 'Push通知',      val: (p: PlanId) => PLANS[p].features.pushNotifications ? 'ok' : 'no' },
                { label: 'ブランド非表示', val: (p: PlanId) => !PLANS[p].showBranding ? 'ok' : 'no' },
                { label: '月次レポート',   val: (p: PlanId) => PLANS[p].features.monthlyReport ? 'ok' : 'no' },
                { label: '優先サポート',   val: (p: PlanId) => PLANS[p].features.prioritySupport ? 'ok' : 'no' },
              ].map(({ label, val }, i) => (
                <tr key={label} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 16px', color: '#4A2C1A', borderBottom: '1px solid #F5E8DC' }}>{label}</td>
                  {planOrder.map(p => {
                    const v = val(p)
                    return (
                      <td key={p} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #F5E8DC' }}>
                        {v === 'ok' ? CHECK : v === 'no' ? DASH : <span style={{ fontWeight: 600, color: '#1C0F05', fontSize: 11 }}>{v}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 注意事項 */}
        <div style={{ marginTop: 24, fontSize: 11.5, color: '#A08068', lineHeight: 1.9 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>月次トークンは毎月更新日にリセット（未使用分の繰り越しなし）</li>
            <li>トークン不足時はトークン補充パックで追加可能（全プラン共通）</li>
            <li>ダウングレードは現在の契約期間終了後に適用</li>
            <li>お支払いはStripeの安全な決済ページで処理されます</li>
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
