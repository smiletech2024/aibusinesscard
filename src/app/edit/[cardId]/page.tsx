'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CardData {
  full_name: string; title: string; company: string
  short_intro: string; email: string; phone: string; website: string
  cta_label: string; cta_url: string
}

const cardFields = [
  { key: 'full_name',   label: '氏名',     placeholder: '山田 太郎',                  required: true,  multiline: false },
  { key: 'title',       label: '肩書き',   placeholder: 'マーケティングコンサルタント', required: false, multiline: false },
  { key: 'company',     label: '会社名',   placeholder: '株式会社 Example',            required: false, multiline: false },
  { key: 'short_intro', label: '自己紹介', placeholder: '例）Webマーケティング歴10年。ROI改善・新規顧客開拓を得意とし、累計50社以上の支援実績があります。お気軽にご相談ください！', required: false, multiline: true },
  { key: 'email',       label: 'メール',   placeholder: 'you@example.com',             required: false, multiline: false },
  { key: 'phone',       label: '電話番号', placeholder: '090-xxxx-xxxx',               required: false, multiline: false },
  { key: 'website',     label: 'Web',      placeholder: 'https://yoursite.com',        required: false, multiline: false },
]

export default function EditCardPage() {
  const { cardId } = useParams() as { cardId: string }
  const router = useRouter()
  const supabase = createClient()

  const [cardData, setCardData] = useState<CardData>({
    full_name: '', title: '', company: '', short_intro: '', email: '', phone: '', website: '',
    cta_label: '', cta_url: '',
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
        cta_label:   (card as { cta_label?: string }).cta_label ?? '',
        cta_url:     (card as { cta_url?: string }).cta_url     ?? '',
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
        body: JSON.stringify({
          ...cardData,
          cta_label: cardData.cta_label || null,
          cta_url:   cardData.cta_url   || null,
        }),
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF5F0' }}>
        <div className="w-8 h-8 border-4 rounded-full spin"
          style={{ borderColor: '#EDD9C8', borderTopColor: '#F26722' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAF5F0' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'white', borderBottom: '1px solid #EDD9C8' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#FAF5F0', border: 'none', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="font-black text-base" style={{ color: '#1C0F05' }}>名刺情報を編集</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="card p-6 space-y-4">
          {cardFields.map(({ key, label, placeholder, required, multiline }) => (
            <div key={key}>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#4A2C1A' }}>
                {label}{required && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
              </label>
              {multiline ? (
                <textarea
                  value={cardData[key as keyof CardData]}
                  onChange={e => setCardData(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={4}
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 14,
                    border: '1.5px solid #DEC4AD', borderRadius: 10,
                    background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                    boxSizing: 'border-box', resize: 'vertical',
                    fontFamily: 'inherit', lineHeight: 1.7,
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#F26722'
                    e.target.style.background = '#fff'
                    e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.12)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#DEC4AD'
                    e.target.style.background = '#FAF5F0'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              ) : (
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={cardData[key as keyof CardData]}
                  onChange={e => setCardData(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 14,
                    border: '1.5px solid #DEC4AD', borderRadius: 10,
                    background: '#FAF5F0', color: '#1C0F05', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#F26722'
                    e.target.style.background = '#fff'
                    e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.12)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#DEC4AD'
                    e.target.style.background = '#FAF5F0'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              )}
            </div>
          ))}

          {/* CTA（成約ボタン） */}
          <div style={{ marginTop: 8, padding: '16px', background: 'rgba(242,103,34,0.05)', border: '1.5px solid rgba(242,103,34,0.2)', borderRadius: 14 }}>
            <p className="text-sm font-black mb-0.5" style={{ color: '#1C0F05' }}>
              🎯 成約ボタン <span className="text-xs font-normal" style={{ color: '#A08068' }}>（任意）</span>
            </p>
            <p className="text-xs mb-4" style={{ color: '#A08068' }}>お客様のカードページに「予約する」「注文する」などのボタンを表示できます</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#4A2C1A' }}>ボタンのラベル</label>
                <input
                  type="text"
                  value={cardData.cta_label}
                  onChange={e => setCardData(p => ({ ...p, cta_label: e.target.value }))}
                  placeholder="例：今すぐ予約する / 注文ページへ"
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 14,
                    border: '1.5px solid #DEC4AD', borderRadius: 10,
                    background: '#FAF5F0', color: '#1C0F05', outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#4A2C1A' }}>遷移先URL</label>
                <input
                  type="url"
                  value={cardData.cta_url}
                  onChange={e => setCardData(p => ({ ...p, cta_url: e.target.value }))}
                  placeholder="https://your-booking-site.com"
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 14,
                    border: '1.5px solid #DEC4AD', borderRadius: 10,
                    background: '#FAF5F0', color: '#1C0F05', outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#F26722'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#DEC4AD'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#EF4444' }}>{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                flex: 1, padding: '13px', fontSize: 14, fontWeight: 600,
                background: '#FAF5F0', color: '#6B7280',
                border: '1.5px solid #DEC4AD', borderRadius: 12, cursor: 'pointer',
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
                  ? 'linear-gradient(135deg, #F26722, #F59340)'
                  : '#DEC4AD',
                color: cardData.full_name && !saving ? 'white' : '#A08068',
                border: 'none', borderRadius: 12,
                cursor: cardData.full_name && !saving ? 'pointer' : 'not-allowed',
                boxShadow: cardData.full_name && !saving ? '0 4px 14px rgba(242,103,34,0.3)' : 'none',
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
