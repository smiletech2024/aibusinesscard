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
        setMessage('📩 確認メールをお送りしました。\nメール内の「メールアドレスを確認する」をタップすると、あなたの分身AI作成が始まります。\n（届かない場合は迷惑メールフォルダもご確認ください）')
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
              '約3分で、あなたらしいAIが完成する',
              'QRコード一枚で、24時間対応が始まる',
              '要約＋相性スコアつきで、本物の商談へ',
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
              {isSignUp ? '分身AIを作成する' : 'おかえりなさい'}
            </h1>
            <p className="text-sm" style={{ color: '#A08068' }}>
              {isSignUp ? '無料・約3分で完成します' : 'あなたのAIが待っています'}
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

            {error && (
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
              disabled={loading}
              style={{
                width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
                background: loading ? '#F5C09A' : 'linear-gradient(135deg, #F26722, #F59340)',
                color: 'white', border: 'none', borderRadius: 14, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(242,103,34,0.4)', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {loading ? '準備中...' : isSignUp ? '分身AIを作り始める →' : 'ログイン'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              style={{ fontSize: 14, fontWeight: 600, color: '#F26722', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {isSignUp ? 'すでにアカウントをお持ちの方はこちら →' : 'アカウントをお持ちでない方 →'}
            </button>
            {!isSignUp && (
              <Link href="/auth/reset-password"
                style={{ fontSize: 13, color: '#A08068', textDecoration: 'none' }}>
                パスワードを忘れた方はこちら
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
