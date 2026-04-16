'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ConfirmContent() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus]   = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type      = searchParams.get('type') as 'signup' | 'recovery' | 'email_change' | 'invite' | 'magiclink' | null

    if (!tokenHash || !type) {
      setStatus('error')
      setMessage('無効なリンクです。メールのリンクを再度クリックしてください。')
      return
    }

    const verify = async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

      if (error) {
        console.error('[confirm]', error)
        setStatus('error')
        setMessage('リンクが無効または期限切れです。再度登録をお試しください。')
      } else {
        setStatus('success')
        setMessage('メールアドレスの確認が完了しました！')
        setTimeout(() => router.push('/dashboard'), 2500)
      }
    }

    verify()
  }, [searchParams, router])

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF5F0',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '48px 32px',
        maxWidth: 400, width: '100%', textAlign: 'center',
        boxShadow: '0 8px 40px rgba(242,103,34,0.1)',
        border: '1px solid #EDD9C8',
      }}>
        {/* ロゴ */}
        <div style={{ fontSize: 20, fontWeight: 900, color: '#F26722', marginBottom: 32 }}>AI名刺</div>

        {status === 'loading' && (
          <>
            <div style={{
              width: 44, height: 44,
              border: '3px solid #EDD9C8', borderTopColor: '#F26722',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ color: '#A08068', fontSize: 14 }}>確認中...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#1C0F05', fontWeight: 900, fontSize: 20, marginBottom: 10 }}>
              確認完了！
            </h2>
            <p style={{ color: '#A08068', fontSize: 14, marginBottom: 24 }}>{message}</p>
            <div style={{
              background: '#FFF0E8', borderRadius: 12, padding: '10px 16px',
              fontSize: 13, color: '#F26722', fontWeight: 600,
            }}>
              ダッシュボードへ移動しています…
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: '#1C0F05', fontWeight: 900, fontSize: 20, marginBottom: 10 }}>
              確認に失敗しました
            </h2>
            <p style={{ color: '#A08068', fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
              {message}
            </p>
            <a href="/auth/login"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg,#F26722,#F59340)',
                color: '#fff', fontWeight: 800, fontSize: 14,
                padding: '12px 32px', borderRadius: 99, textDecoration: 'none',
              }}>
              ログインページへ →
            </a>
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#FAF5F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #EDD9C8', borderTopColor: '#F26722', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  )
}
