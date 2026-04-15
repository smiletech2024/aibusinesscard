'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CardData {
  full_name: string; title: string; company: string
  short_intro: string; email: string; phone: string; website: string
}

const cardFields = [
  { key: 'full_name',   label: '氏名',     placeholder: '山田 太郎',                  required: true },
  { key: 'title',       label: '肩書き',   placeholder: 'マーケティングコンサルタント', required: false },
  { key: 'company',     label: '会社名',   placeholder: '株式会社 Example',            required: false },
  { key: 'short_intro', label: '一言紹介', placeholder: 'ROI改善が得意なWebマーケター', required: false },
  { key: 'email',       label: 'メール',   placeholder: 'you@example.com',             required: false },
  { key: 'phone',       label: '電話番号', placeholder: '090-xxxx-xxxx',               required: false },
  { key: 'website',     label: 'Web',      placeholder: 'https://yoursite.com',        required: false },
]

export default function EditCardPage() {
  const { cardId } = useParams() as { cardId: string }
  const router = useRouter()
  const supabase = createClient()

  const [cardData, setCardData] = useState<CardData>({
    full_name: '', title: '', company: '', short_intro: '', email: '', phone: '', website: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: card } = await supabase
        .from('business_cards')
        .select('*')
        .eq('id', cardId)
        .eq('user_id', user.id)
        .single()

      if (!card) { router.push('/dashboard'); return }

      setCardData({
        full_name:   card.full_name   ?? '',
        title:       card.title       ?? '',
        company:     card.company     ?? '',
        short_intro: card.short_intro ?? '',
        email:       card.email       ?? '',
        phone:       card.phone       ?? '',
        website:     card.website     ?? '',
      })
      setLoading(false)
    }
    load()
  }, [cardId])

  const handleSave = async () => {
    if (!cardData.full_name || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/card/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setError('保存に失敗しました。もう一度お試しください。')
        setSaving(false)
      }
    } catch {
      setError('通信エラーが発生しました。')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F3FA' }}>
        <div className="w-8 h-8 border-4 rounded-full spin"
          style={{ borderColor: '#E8E6F5', borderTopColor: '#6366F1' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F3FA' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'white', borderBottom: '1px solid #E8E6F5' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#F4F3FA', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="font-black text-base" style={{ color: '#1E1B4B' }}>名刺情報を編集</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="card p-6 space-y-4">
          {cardFields.map(({ key, label, placeholder, required }) => (
            <div key={key}>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#4A4870' }}>
                {label}{required && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
              </label>
              <input
                type={key === 'email' ? 'email' : 'text'}
                value={cardData[key as keyof CardData]}
                onChange={e => setCardData(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{
                  width: '100%', padding: '11px 14px', fontSize: 14,
                  border: '1.5px solid #D1D0E8', borderRadius: 10,
                  background: '#F4F3FA', color: '#1E1B4B', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#6366F1'
                  e.target.style.background = '#fff'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#D1D0E8'
                  e.target.style.background = '#F4F3FA'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          ))}

          {error && (
            <p className="text-sm text-center" style={{ color: '#EF4444' }}>{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                flex: 1, padding: '13px', fontSize: 14, fontWeight: 600,
                background: '#F4F3FA', color: '#6B7280',
                border: '1.5px solid #D1D0E8', borderRadius: 12, cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={!cardData.full_name || saving}
              style={{
                flex: 2, padding: '13px', fontSize: 15, fontWeight: 700,
                background: cardData.full_name && !saving
                  ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                  : '#D1D0E8',
                color: cardData.full_name && !saving ? 'white' : '#9896B8',
                border: 'none', borderRadius: 12,
                cursor: cardData.full_name && !saving ? 'pointer' : 'not-allowed',
                boxShadow: cardData.full_name && !saving ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
