'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CREDIT_PACKAGES, formatTokens, INPUT_YEN_PER_TOKEN, OUTPUT_YEN_PER_TOKEN } from '@/lib/credits'
import Link from 'next/link'

// ─── サーチパラムを読む内部コンポーネント ────────────────────────
function CreditsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [balance, setBalance]           = useState<number | null>(null)
  const [totalUsed, setTotalUsed]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [purchasing, setPurchasing]     = useState<string | null>(null)

  const successPkg = searchParams.get('success') === '1' ? searchParams.get('package') : null
  const cancelled  = searchParams.get('cancel') === '1'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    try {
      const res = await fetch('/api/credits/balance')
      if (res.ok) {
        const json = await res.json()
        setBalance(json.balance)
        setTotalUsed(json.total_used)
      }
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => { load() }, [load])

  const handlePurchase = async (packageId: string) => {
    setPurchasing(packageId)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ packageId }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        alert('決済ページの作成に失敗しました。時間をおいて再度お試しください。')
        setPurchasing(null)
      }
    } catch {
      alert('通信エラーが発生しました。')
      setPurchasing(null)
    }
  }

  // 残高レベル
  const balanceLow   = balance !== null && balance < 50_000
  const balanceEmpty = balance !== null && balance <= 0

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0', paddingBottom: 60 }}>

      {/* ── ヘッダー ── */}
      <div style={{
        background: 'linear-gradient(135deg, #C4511A 0%, #F26722 100%)',
        padding: '24px 20px 32px',
        color: '#fff',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            ← ダッシュボードに戻る
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>トークン残高</h1>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 0' }}>分身AIが会話するたびに消費されます</p>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>

        {/* ── 成功・キャンセルバナー ── */}
        {successPkg && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: '12px 16px', marginTop: 20, color: '#065F46', fontWeight: 600, fontSize: 14 }}>
            🎉 {successPkg}パックの購入が完了しました！トークンが追加されました。
          </div>
        )}
        {cancelled && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 16px', marginTop: 20, color: '#92400E', fontSize: 14 }}>
            決済がキャンセルされました。
          </div>
        )}

        {/* ── 残高カード ── */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #EDD9C8',
          padding: '24px 20px',
          marginTop: 20,
          boxShadow: '0 4px 20px rgba(242,103,34,0.08)',
        }}>
          {loading ? (
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24, border: '3px solid #EDD9C8', borderTopColor: '#F26722', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#A08068', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>現在の残高</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontSize: 42,
                  fontWeight: 800,
                  color: balanceEmpty ? '#EF4444' : balanceLow ? '#F59E0B' : '#1C0F05',
                  lineHeight: 1,
                }}>
                  {formatTokens(balance ?? 0)}
                </span>
                <span style={{ fontSize: 15, color: '#A08068', fontWeight: 600 }}>トークン</span>
              </div>
              {balanceEmpty && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#EF4444', fontWeight: 600 }}>
                  ⚠️ 残高がありません。分身AIが応答できない状態です。
                </div>
              )}
              {balanceLow && !balanceEmpty && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#F59E0B', fontWeight: 600 }}>
                  ⚠️ 残高が少なくなっています。
                </div>
              )}
              <div style={{ marginTop: 16, display: 'flex', gap: 24, fontSize: 13, color: '#A08068' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>累計使用:</span>{' '}
                  {formatTokens(totalUsed)}トークン
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 料金体系の説明 ── */}
        <div style={{ marginTop: 24, padding: '14px 16px', background: '#FFF0E8', borderRadius: 12, fontSize: 12.5, color: '#4A2C1A', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📌 料金体系について</div>
          <div>ChatGPT-4o API標準価格の1.2倍を請求単価として設定しています。</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 16 }}>
            <span>入力: ¥{(INPUT_YEN_PER_TOKEN * 1000).toFixed(4)}/1Kトークン</span>
            <span>出力: ¥{(OUTPUT_YEN_PER_TOKEN * 1000).toFixed(4)}/1Kトークン</span>
          </div>
          <div style={{ marginTop: 4, opacity: 0.75 }}>※ 1回の会話交換で約1,000〜2,000トークンを消費します</div>
        </div>

        {/* ── 購入パッケージ ── */}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1C0F05', margin: '28px 0 14px' }}>トークンを購入</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CREDIT_PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              style={{
                background: '#fff',
                border: pkg.popular ? '2px solid #F26722' : '1px solid #EDD9C8',
                borderRadius: 16,
                padding: '16px 18px',
                position: 'relative',
                boxShadow: pkg.popular ? '0 4px 20px rgba(242,103,34,0.15)' : '0 2px 8px rgba(242,103,34,0.05)',
              }}
            >
              {pkg.popular && (
                <div style={{
                  position: 'absolute', top: -10, left: 20,
                  background: 'linear-gradient(135deg,#F26722,#F59340)',
                  color: '#fff', fontSize: 11, fontWeight: 800,
                  padding: '2px 10px', borderRadius: 99, letterSpacing: '0.05em',
                }}>
                  人気
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05' }}>{pkg.name}</span>
                    {pkg.bonusLabel && (
                      <span style={{ background: '#FFF0E8', color: '#F26722', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99 }}>
                        {pkg.bonusLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: pkg.popular ? '#F26722' : '#1C0F05' }}>
                      {formatTokens(pkg.tokens)}
                    </span>
                    <span style={{ fontSize: 13, color: '#A08068', marginLeft: 4 }}>トークン</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#A08068', marginTop: 2 }}>
                    約 {Math.floor(pkg.tokens / 1500).toLocaleString('ja-JP')} 〜 {Math.floor(pkg.tokens / 800).toLocaleString('ja-JP')} 回の会話
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1C0F05' }}>
                    ¥{pkg.priceJpy.toLocaleString('ja-JP')}
                  </div>
                  <button
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={!!purchasing}
                    style={{
                      marginTop: 8,
                      background: pkg.popular
                        ? 'linear-gradient(135deg,#F26722,#F59340)'
                        : '#FAF5F0',
                      color: pkg.popular ? '#fff' : '#F26722',
                      border: pkg.popular ? 'none' : '1.5px solid #F26722',
                      borderRadius: 99,
                      padding: '8px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: purchasing ? 'not-allowed' : 'pointer',
                      opacity: purchasing ? 0.6 : 1,
                      minWidth: 80,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {purchasing === pkg.id ? (
                      <>
                        <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        処理中…
                      </>
                    ) : (
                      '購入する'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 注意事項 ── */}
        <div style={{ marginTop: 24, fontSize: 12, color: '#A08068', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>ご注意</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>購入したトークンに有効期限はありません</li>
            <li>お支払いはStripeの安全な決済ページで行われます</li>
            <li>購入後のキャンセル・返金は原則承っておりません</li>
            <li>法人払い（請求書払い）はお問い合わせください</li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── ページコンポーネント（Suspenseラップ）─────────────────────
export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#FAF5F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #EDD9C8', borderTopColor: '#F26722', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <CreditsContent />
    </Suspense>
  )
}
