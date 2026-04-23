'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'

function UnsubscribeContent() {
  const params    = useSearchParams()
  const router    = useRouter()
  const userId    = params.get('userId') ?? ''
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (!userId) { setStatus('error'); return }
    setStatus('idle')
  }, [userId])

  const handleUnsubscribe = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/unsubscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#FAF5F0' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{ background: 'white', border: '1px solid #EDD9C8', boxShadow: '0 4px 24px rgba(242,103,34,0.08)' }}
      >
        <div className="mb-6">
          <Logo size={28} variant="dark" />
        </div>

        {status === 'done' ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 className="font-black text-lg mb-2" style={{ color: '#1C0F05' }}>
              配信停止が完了しました
            </h1>
            <p className="text-sm mb-6" style={{ color: '#A08068', lineHeight: 1.7 }}>
              週次レポートメールの配信を停止しました。<br />
              設定はダッシュボードからいつでも変更できます。
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                width: '100%', padding: '12px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, #F26722, #F59340)',
                color: 'white', border: 'none', cursor: 'pointer',
              }}
            >
              ダッシュボードへ →
            </button>
          </>
        ) : status === 'error' ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 className="font-black text-lg mb-2" style={{ color: '#1C0F05' }}>
              エラーが発生しました
            </h1>
            <p className="text-sm mb-6" style={{ color: '#A08068' }}>
              リンクが無効か、すでに処理済みです。<br />
              お手数ですが <a href="mailto:admin@aimeishi.biz" style={{ color: '#F26722' }}>admin@aimeishi.biz</a> までご連絡ください。
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h1 className="font-black text-lg mb-2" style={{ color: '#1C0F05' }}>
              メール配信停止
            </h1>
            <p className="text-sm mb-6" style={{ color: '#A08068', lineHeight: 1.7 }}>
              AI名刺の週次レポートメールの配信を停止します。<br />
              ダッシュボードへのアクセスや機能利用に影響はありません。
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={status === 'loading' || !userId}
              style={{
                width: '100%', padding: '12px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                background: status === 'loading' ? '#F5C09A' : '#EF4444',
                color: 'white', border: 'none',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'loading' ? '処理中...' : '配信を停止する'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                width: '100%', marginTop: 10, padding: '11px', borderRadius: 14,
                fontSize: 13, fontWeight: 600, background: '#FAF5F0',
                color: '#A08068', border: '1px solid #EDD9C8', cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF5F0' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #EDD9C8', borderTopColor: '#F26722', borderRadius: '50%' }} className="spin" />
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  )
}
