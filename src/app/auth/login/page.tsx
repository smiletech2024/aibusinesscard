'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error
        setMessage('確認メールを送信しました。メールをご確認ください。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
        <Link href="/"><Logo size={32} variant="light" /></Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            あなたの分身AIが<br />
            <span style={{ color: '#C4B5FD' }}>24時間営業</span>します
          </h2>
          <div className="space-y-4">
            {[
              { icon: '✦', text: 'ヒアリングAIがあなたの人格を学習' },
              { icon: '✦', text: 'QRコードで顧客と即つながる' },
              { icon: '✦', text: '会話サマリー付きで本会話へ移行' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/80">
                <span className="text-purple-300 text-xs">{icon}</span>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">© 2026 AI名刺</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/"><Logo size={32} variant="dark" /></Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>
              {isSignUp ? 'アカウントを作成' : 'おかえりなさい'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {isSignUp ? '無料で始められます' : 'アカウントにログイン'}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#4A4870' }}>
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '12px 16px', fontSize: 15,
                  border: '1.5px solid #D1D0E8', borderRadius: 12,
                  background: '#F4F3FA', color: '#1E1B4B', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.12)' }}
                onBlur={e => { e.target.style.borderColor = '#D1D0E8'; e.target.style.background = '#F4F3FA'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#4A4870' }}>
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
                  width: '100%', padding: '12px 16px', fontSize: 15,
                  border: '1.5px solid #D1D0E8', borderRadius: 12,
                  background: '#F4F3FA', color: '#1E1B4B', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.12)' }}
                onBlur={e => { e.target.style.borderColor = '#D1D0E8'; e.target.style.background = '#F4F3FA'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 500 }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 500 }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
                background: loading ? '#A5B4FC' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white', border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? '処理中...' : isSignUp ? 'アカウントを作成する' : 'ログイン'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              style={{ fontSize: 14, fontWeight: 500, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {isSignUp ? 'すでにアカウントをお持ちの方 →' : 'アカウントを作成する →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
