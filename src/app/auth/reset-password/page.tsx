'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

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
        <div style={{ fontSize: 20, fontWeight: 900, color: '#F26722', marginBottom: 32 }}>AI名刺</div>

        {sent ? (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📩</div>
            <h2 style={{ color: '#1C0F05', fontWeight: 900, fontSize: 20, marginBottom: 12 }}>
              メールを送信しました
            </h2>
            <p style={{ color: '#A08068', fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>
              <strong style={{ color: '#1C0F05' }}>{email}</strong> に<br />
              パスワードリセットのリンクを送りました。<br />
              メールの「パスワードを再設定する」を<br />
              クリックしてください。
            </p>
            <p style={{ color: '#C4A882', fontSize: 12, marginBottom: 24 }}>
              ※ 届かない場合は迷惑メールフォルダもご確認ください
            </p>
            <Link href="/auth/login"
              style={{
                display: 'inline-block', fontSize: 14, fontWeight: 600,
                color: '#F26722', textDecoration: 'none',
              }}>
              ← ログインへ戻る
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ color: '#1C0F05', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>
              パスワードを忘れた方
            </h2>
            <p style={{ color: '#A08068', fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
              登録済みのメールアドレスを入力してください。<br />
              パスワードリセットのリンクをお送りします。
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
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
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(242,103,34,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              {error && (
                <div style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: 12, padding: '12px 14px', fontSize: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
                  background: loading ? '#F5C09A' : 'linear-gradient(135deg, #F26722, #F59340)',
                  color: 'white', border: 'none', borderRadius: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(242,103,34,0.4)',
                }}
              >
                {loading ? '送信中...' : 'リセットメールを送信 →'}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link href="/auth/login"
                style={{ fontSize: 14, fontWeight: 600, color: '#F26722', textDecoration: 'none' }}>
                ← ログインへ戻る
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
