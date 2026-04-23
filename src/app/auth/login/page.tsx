'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [message, setMessage]   = useState('')
  // レート制限
  const [attempts, setAttempts]         = useState(0)
  const [lockedUntil, setLockedUntil]   = useState<Date | null>(null)
  const [countdown, setCountdown]       = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  // カウントダウンタイマー
  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setCountdown(0)
        setAttempts(0)
        if (countdownRef.current) clearInterval(countdownRef.current)
      } else {
        setCountdown(remaining)
      }
    }
    tick()
    countdownRef.current = setInterval(tick, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [lockedUntil])

  const isLocked = lockedUntil !== null && lockedUntil > new Date()

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m > 0 ? `${m}分${s}秒` : `${s}秒`
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (isSignUp) {
        const referredBy = typeof window !== 'undefined' ? localStorage.getItem('aimeishi_ref') : null
        const res  = await fetch('/api/auth/signup', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password, referredBy }),
        })
        const data = await res.json()
        if (res.status === 409) {
          setError('このアドレスはすでに登録済みです。ログインしてください。')
          return
        }
        if (!res.ok) throw new Error(data.error || 'signup_failed')
        setMessage('📩 確認メールをお送りしました。\nメール内のボタンを押すと、分身AI作成が始まります。\n（届かない場合は迷惑メールフォルダもご確認ください）')
      } else {
        // レート制限付きログイン API を使用
        const res  = await fetch('/api/auth/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        })
        const data = await res.json()

        if (res.status === 429) {
          // ロック
          setLockedUntil(new Date(data.lockedUntil))
          setAttempts(5)
          setError('')
          return
        }

        if (!res.ok) {
          const remaining = data.remaining ?? 0
          setAttempts(data.attempts ?? attempts + 1)
          if (remaining === 1) {
            setError(`メールアドレスかパスワードが違います。あと${remaining}回でロックされます。`)
          } else if (remaining > 1) {
            setError(`メールアドレスまたはパスワードが違います。（残り${remaining}回）`)
          } else {
            setError('メールアドレスまたはパスワードが違います。')
          }
          return
        }

        // 成功 → セッションをセットして完全リロード
        await supabase.auth.setSession({
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
        })
        setAttempts(0)
        window.location.href = '/dashboard'
      }
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
      if (msg.includes('rate limit') || msg.includes('429') || msg.includes('over_email_send_rate_limit') || msg.includes('email rate limit')) {
        if (isSignUp) {
          setError('現在メール送信が混み合っています。1時間ほど時間をおいてから再度お試しいただくか、admin@aimeishi.biz までお問い合わせください。')
        } else {
          setError('しばらく時間をおいてから再度お試しください。')
        }
      } else if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('このアドレスはすでに登録済みです。ログインしてください。')
      } else if (msg.includes('invalid email')) {
        setError('メールアドレスの形式が正しくありません。')
      } else if (msg.includes('Password should')) {
        setError('パスワードは6文字以上で入力してください。')
      } else if (msg.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが違います。')
      } else if (msg.includes('Email not confirmed')) {
        setError('メールアドレスが未確認です。届いた確認メールのボタンを押してください。')
      } else {
        setError(msg || 'エラーが発生しました。再度お試しください。')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — dark premium */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: '#07060F' }}
      >
        <Link href="/"><Logo size={32} variant="light" /></Link>

        <div className="relative z-10">
          <h2
            className="font-black leading-tight mb-8"
            style={{ color: '#FFF0E8', fontSize: 36 }}
          >
            名刺を渡した瞬間から、<br />
            <span style={{ color: '#F5843A' }}>商談が動き始める。</span>
          </h2>
          <div className="space-y-5">
            {[
              '約3分で、あなたとして話すAIが完成する',
              'QRコード一枚で、24時間対応が始まる',
              '相性スコアつきで、本物の商談だけ届く',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(242,103,34,0.2)', border: '1px solid rgba(242,103,34,0.4)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm" style={{ color: '#A08068' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Quote card */}
          <div
            className="mt-10 p-5 rounded-2xl"
            style={{
              background: '#0F0E20',
              border: '1px solid rgba(242,103,34,0.15)',
            }}
          >
            <p className="text-sm italic mb-3 leading-relaxed" style={{ color: '#A08068' }}>
              「寝ている間に3件の問い合わせが来ていた。<br />全部、AIが整理してくれていた。」
            </p>
            <p className="text-xs" style={{ color: '#6B4030' }}>— AI名刺ユーザーの声</p>
          </div>
        </div>

        <p style={{ color: '#6B4030', fontSize: 12 }}>© 2026 AI名刺</p>
      </div>

      {/* Right panel — light clean */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ background: '#F5F4FC' }}
      >
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/"><Logo size={32} variant="dark" /></Link>
          </div>

          <div className="mb-8">
            <h1 className="font-black mb-1" style={{ color: '#1C0F05', fontSize: 26 }}>
              {isSignUp ? '分身AIを作る' : 'おかえりなさい'}
            </h1>
            <p className="text-sm" style={{ color: '#A08068' }}>
              {isSignUp ? '無料、3分で完成します' : 'あなたのAIが待っています'}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#4A2C1A' }}>
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '13px 16px', fontSize: 15,
                  border: '1.5px solid #DEC4AD', borderRadius: 14,
                  background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                  boxSizing: 'border-box', transition: 'all 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(242,103,34,0.12)' }}
                onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#4A2C1A' }}>
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6文字以上"
                style={{
                  width: '100%', padding: '13px 16px', fontSize: 15,
                  border: '1.5px solid #DEC4AD', borderRadius: 14,
                  background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                  boxSizing: 'border-box', transition: 'all 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(242,103,34,0.12)' }}
                onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* ロックアウト表示 */}
            {isLocked && (
              <div style={{ background: '#FFF1F2', border: '1.5px solid #FECDD3', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
                <div style={{ color: '#E11D48', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                  ロックされています
                </div>
                <div style={{ color: '#9F1239', fontSize: 13, marginBottom: 10 }}>
                  5回連続で失敗したため、一時停止しました
                </div>
                <div style={{ background: '#FECDD3', borderRadius: 8, padding: '10px', fontSize: 20, fontWeight: 900, color: '#E11D48', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCountdown(countdown)}
                </div>
                <div style={{ color: '#9F1239', fontSize: 11, marginTop: 6 }}>
                  タイマーが0になると自動で解除されます
                </div>
              </div>
            )}

            {/* 残り試行回数警告 */}
            {!isLocked && attempts >= 3 && attempts < 5 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
                ⚠️ あと{5 - attempts}回失敗すると15分間ロックされます
              </div>
            )}

            {error && !isLocked && (
              <div style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 500 }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 12, padding: '16px', fontSize: 14, fontWeight: 500, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              style={{
                width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
                background: (loading || isLocked) ? '#F5C09A' : 'linear-gradient(135deg, #F26722, #F59340)',
                color: 'white', border: 'none', borderRadius: 14, cursor: (loading || isLocked) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(242,103,34,0.4)', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              {loading ? '確認中...' : isLocked ? `🔒 ${formatCountdown(countdown)}後に解除` : isSignUp ? '分身AIを作る →' : 'ログイン'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              style={{ fontSize: 14, fontWeight: 600, color: '#F26722', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {isSignUp ? 'すでに登録済みの方' : 'はじめての方'}
            </button>
            {!isSignUp && (
              <Link href="/auth/reset-password"
                style={{ fontSize: 13, color: '#A08068', textDecoration: 'none' }}>
                パスワードを忘れた場合
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
