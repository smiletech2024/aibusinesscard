'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const CATEGORIES = [
  { value: 'general', label: '💬 一般的なご意見' },
  { value: 'feature', label: '✨ 機能リクエスト' },
  { value: 'bug',     label: '🐛 不具合の報告' },
]

export default function FeedbackPage() {
  const router = useRouter()
  const supabase = createClient()

  const [category, setCategory] = useState('general')
  const [body, setBody]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login')
      else setAuthChecked(true)
    })
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) { setError('内容を入力してください'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, body }),
    })
    const json = await res.json()

    if (res.ok) {
      setSuccess(true)
      setBody('')
    } else {
      setError(json.error ?? '送信に失敗しました')
    }
    setLoading(false)
  }

  if (!authChecked) return null

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0' }}>
      {/* ヘッダー */}
      <div style={{ background: 'linear-gradient(135deg,#C4511A,#F26722)', padding: '20px 20px 32px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            ← ダッシュボード
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>意見箱</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '6px 0 0' }}>
            ご意見・ご要望・不具合報告をお気軽にどうぞ
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 80px' }}>
        {success && (
          <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: '14px 18px', marginBottom: 24, color: '#065F46', fontWeight: 600, fontSize: 14 }}>
            🎉 送信しました！ご意見ありがとうございます。内容を確認の上、改善に活かします。
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDD9C8', padding: '28px 24px' }}>
          <form onSubmit={handleSubmit}>
            {/* カテゴリ選択 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#A08068', display: 'block', marginBottom: 10 }}>カテゴリ</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    style={{
                      padding: '8px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                      background: category === c.value ? '#F26722' : '#FAF5F0',
                      borderColor: category === c.value ? '#F26722' : '#EDD9C8',
                      color: category === c.value ? '#fff' : '#4A2C1A',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#A08068', display: 'block', marginBottom: 8 }}>
                内容 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="使ってみた感想、こんな機能があればいいな、バグの詳細など何でもお気軽にどうぞ"
                rows={6}
                maxLength={2000}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #EDD9C8',
                  fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none',
                  background: '#FAFAFA', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
              <div style={{ textAlign: 'right', fontSize: 11, color: body.length > 1800 ? '#EF4444' : '#A08068', marginTop: 4 }}>
                {body.length} / 2000
              </div>
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !body.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 99, fontSize: 15, fontWeight: 800,
                background: loading || !body.trim() ? '#EDD9C8' : 'linear-gradient(135deg,#C4511A,#F26722)',
                color: loading || !body.trim() ? '#A08068' : '#fff',
                border: 'none', cursor: loading || !body.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '送信中…' : '送信する'}
            </button>
          </form>
        </div>

        <div style={{ marginTop: 20, padding: '14px 18px', background: '#FFF0E8', borderRadius: 12, fontSize: 12.5, color: '#4A2C1A', lineHeight: 1.7 }}>
          💡 いただいたご意見はすべて確認しています。返信が必要な場合は
          <a href="mailto:admin@aimeishi.biz" style={{ color: '#F26722', marginLeft: 4 }}>admin@aimeishi.biz</a>
          までご連絡ください。
        </div>
      </div>
    </div>
  )
}
