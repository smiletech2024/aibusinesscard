'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2500)
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

        {done ? (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#1C0F05', fontWeight: 900, fontSize: 20, marginBottom: 12 }}>
              パスワードを変更しました
            </h2>
            <p style={{ color: '#A08068', fontSize: 14, marginBottom: 24 }}>
              ダッシュボードへ移動しています…
            </p>
            <div style={{ background: '#FFF0E8', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#F26722', fontWeight: 600 }}>
              しばらくお待ちください
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#1C0F05', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>
              新しいパスワードを設定
            </h2>
            <p style={{ color: '#A08068', fontSize: 14, marginBottom: 28 }}>
              6文字以上のパスワードを入力してください
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#4A2C1A' }}>
                  新しいパスワード
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
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(242,103,34,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.background = '#FAF5F0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#4A2C1A' }}>
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="もう一度入力"
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
                {loading ? '変更中...' : 'パスワードを変更する →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
