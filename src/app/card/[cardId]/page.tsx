'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard } from '@/types'
import { CardLayout, LayoutEl, LAYOUT_DEFAULTS } from '@/app/card-editor/[cardId]/page'

type CardPageData = BusinessCard & {
  profiles?: { full_name: string | null; avatar_url: string | null }
  layout_json?: CardLayout | null
}

const SESSION_KEY = (cardId: string) => `aimeishi_session_${cardId}`

// ── アポイントフォーム ─────────────────────────────────────────────
function AppointmentForm({ cardId, ownerName, onClose }: {
  cardId: string
  ownerName: string
  onClose: () => void
}) {
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [phone, setPhone]           = useState('')
  const [date, setDate]                   = useState('')
  const [time, setTime]                   = useState('')
  const [contactableTime, setContactableTime] = useState<string[]>([])
  const [message, setMessage]             = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [done, setDone]                   = useState(false)
  const [error, setError]                 = useState('')

  const timeSlots = ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00']
  const contactableSlots = [
    '平日 午前中', '平日 昼頃', '平日 夕方以降',
    '土日 午前中', '土日 午後', 'いつでもOK',
  ]

  const toggleContactable = (slot: string) =>
    setContactableTime(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])

  const submit = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    if (!email.trim() && !phone.trim()) { setError('メールまたは電話番号を入力してください'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          customerName:    name.trim(),
          customerEmail:   email.trim() || null,
          customerPhone:   phone.trim() || null,
          preferredDate:   date || null,
          preferredTime:   time || null,
          contactableTime: contactableTime.length ? contactableTime.join('・') : null,
          message:         message.trim() || null,
        }),
      })
      if (res.ok) { setDone(true) }
      else { setError('送信に失敗しました。もう一度お試しください。') }
    } catch {
      setError('通信エラーが発生しました。')
    } finally { setSubmitting(false) }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', fontSize: 14,
    border: '1.5px solid rgba(242,103,34,0.2)', borderRadius: 12,
    background: '#1C0F05', color: '#FFF0E8', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }
  const labelStyle = { fontSize: 12, fontWeight: 700, color: '#A08068', display: 'block' as const, marginBottom: 6 }

  if (done) return (
    <div style={{ padding: '32px 20px' }}>
      {/* アイコン＋タイトル */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
        <h3 style={{ color: '#FFF0E8', fontWeight: 800, fontSize: 18, margin: '0 0 6px' }}>
          アポイントを受け付けました！
        </h3>
        <p style={{ color: '#A08068', fontSize: 13, margin: 0 }}>
          {ownerName}に依頼を送りました
        </p>
      </div>

      {/* 次のステップ説明 */}
      <div style={{
        background: 'rgba(242,103,34,0.08)',
        border: '1px solid rgba(242,103,34,0.2)',
        borderRadius: 14,
        padding: '18px 16px',
        marginBottom: 20,
      }}>
        <p style={{ color: '#F5843A', fontWeight: 800, fontSize: 13, margin: '0 0 14px' }}>
          📋 次のステップ
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(242,103,34,0.2)', color: '#F5843A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
            }}>1</span>
            <p style={{ color: '#FFF0E8', fontSize: 13, margin: 0, lineHeight: 1.7 }}>
              <strong>{ownerName}</strong>が日程を確認します
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(242,103,34,0.2)', color: '#F5843A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
            }}>2</span>
            <p style={{ color: '#FFF0E8', fontSize: 13, margin: 0, lineHeight: 1.7 }}>
              ご入力いただいた
              {email ? <><strong style={{ color: '#F5843A' }}> {email} </strong>（メール）</> : ''}
              {phone ? <><strong style={{ color: '#F5843A' }}> {phone} </strong>（電話）</> : ''}
              に連絡が届きます
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(242,103,34,0.2)', color: '#F5843A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
            }}>3</span>
            <p style={{ color: '#FFF0E8', fontSize: 13, margin: 0, lineHeight: 1.7 }}>
              日程が確定したらアポイント成立です！
            </p>
          </div>
        </div>
      </div>

      {/* 注意書き */}
      <p style={{ color: '#6B4030', fontSize: 11, textAlign: 'center', lineHeight: 1.7, marginBottom: 20 }}>
        連絡が来ない場合は、迷惑メールフォルダをご確認いただくか、<br />
        直接 {ownerName} にお問い合わせください。
      </p>

      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14,
          background: 'linear-gradient(135deg,#F5843A,#F59340)', color: '#fff',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(242,103,34,0.35)',
        }}
      >
        閉じる
      </button>
    </div>
  )

  return (
    <div style={{ padding: '20px 16px 24px' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, color: '#FFF0E8', fontWeight: 800, fontSize: 16 }}>
            📅 アポイントを取る
          </h3>
          <p style={{ margin: '4px 0 0', color: '#6B4030', fontSize: 12 }}>
            {ownerName}に直接お会いするご依頼
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer', color: '#A08068', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* お名前 */}
        <div>
          <label style={labelStyle}>お名前 <span style={{ color: '#F5843A' }}>*</span></label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="山田 花子" style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#F26722'}
            onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.2)'}
          />
        </div>

        {/* 連絡先 */}
        <div>
          <label style={labelStyle}>メールアドレス</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#F26722'}
            onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.2)'}
          />
        </div>
        <div>
          <label style={labelStyle}>電話番号</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="090-xxxx-xxxx" style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#F26722'}
            onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.2)'}
          />
        </div>

        {/* 希望日時 */}
        <div>
          <label style={labelStyle}>ご希望日（任意）</label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
            onFocus={e => e.target.style.borderColor = '#F26722'}
            onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.2)'}
          />
        </div>
        <div>
          <label style={labelStyle}>ご希望の時間帯（任意）</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {timeSlots.map(t => (
              <button
                key={t} onClick={() => setTime(time === t ? '' : t)}
                style={{
                  padding: '7px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${time === t ? '#F26722' : 'rgba(242,103,34,0.2)'}`,
                  background: time === t ? 'rgba(242,103,34,0.15)' : 'transparent',
                  color: time === t ? '#F5843A' : '#A08068',
                  cursor: 'pointer',
                }}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* 連絡可能な時間帯 */}
        <div>
          <label style={labelStyle}>
            📞 連絡可能な時間帯（任意・複数選択OK）
          </label>
          <p style={{ fontSize: 11, color: '#6B4030', margin: '0 0 8px' }}>
            {ownerName}がご連絡しやすい時間を教えてください
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {contactableSlots.map(slot => {
              const selected = contactableTime.includes(slot)
              return (
                <button
                  key={slot} onClick={() => toggleContactable(slot)}
                  style={{
                    padding: '8px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${selected ? '#F26722' : 'rgba(242,103,34,0.2)'}`,
                    background: selected ? 'rgba(242,103,34,0.15)' : 'transparent',
                    color: selected ? '#F5843A' : '#A08068',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{slot}</button>
              )
            })}
          </div>
        </div>

        {/* ご用件 */}
        <div>
          <label style={labelStyle}>ご用件・メッセージ（任意）</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder={`例）${ownerName}さんのサービスについてご相談したいことがあります。`}
            rows={3}
            style={{
              ...inputStyle, resize: 'vertical', lineHeight: 1.7,
            }}
            onFocus={e => e.target.style.borderColor = '#F26722'}
            onBlur={e => e.target.style.borderColor = 'rgba(242,103,34,0.2)'}
          />
        </div>

        {error && (
          <p style={{ color: '#F87171', fontSize: 12, textAlign: 'center', margin: 0 }}>{error}</p>
        )}

        <button
          onClick={submit} disabled={submitting}
          style={{
            width: '100%', padding: '14px', fontWeight: 700, fontSize: 15,
            background: submitting ? 'rgba(242,103,34,0.3)' : 'linear-gradient(135deg,#F5843A,#F59340)',
            color: '#fff', border: 'none', borderRadius: 14, cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: submitting ? 'none' : '0 4px 20px rgba(242,103,34,0.4)',
          }}
        >
          {submitting ? '送信中...' : `${ownerName}にアポイントを依頼する →`}
        </button>
      </div>
    </div>
  )
}

// ── メインカードページ ─────────────────────────────────────────────
export default function CardPage() {
  const params = useParams()
  const router = useRouter()
  const cardId = params.cardId as string
  const [card, setCard] = useState<CardPageData | null>(null)
  const [cardDeleted, setCardDeleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [showAppt, setShowAppt] = useState(false)
  const [existingSession, setExistingSession] = useState<{ id: string; status: string } | null>(null)
  const [proceeding, setProceeding] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadCard() }, [cardId])

  const loadCard = async () => {
    const { data } = await supabase
      .from('business_cards')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .eq('id', cardId).single()
    if (data && !data.is_active) {
      setCardDeleted(true)
    } else {
      setCard(data ?? null)
    }

    const savedId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY(cardId)) : null
    if (savedId) {
      const res = await fetch(`/api/session/status?sessionId=${savedId}`)
      if (res.ok) {
        const { session } = await res.json()
        if (session && session.status !== 'closed') {
          setExistingSession(session)
        } else {
          localStorage.removeItem(SESSION_KEY(cardId))
        }
      } else {
        localStorage.removeItem(SESSION_KEY(cardId))
      }
    }
    setLoading(false)
  }

  const proceedToChat = async () => {
    if (!card?.persona_id || proceeding) return
    setProceeding(true)
    const res = await fetch('/api/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: card.persona_id, cardId: card.id, customerName: customerName || null }),
    })
    const { session } = await res.json()
    if (session) {
      localStorage.setItem(SESSION_KEY(cardId), session.id)
      router.push(`/chat/${session.id}`)
    } else {
      setProceeding(false)
    }
  }

  const continueSession = () => { if (existingSession) router.push(`/chat/${existingSession.id}`) }
  const resetSession = () => { localStorage.removeItem(SESSION_KEY(cardId)); setExistingSession(null) }

  const saveVCard = () => {
    if (!card) return
    const nameParts = (card.full_name ?? '').trim().split(/\s+/)
    const familyName = nameParts[0] ?? ''
    const givenName  = nameParts.slice(1).join(' ')
    const lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `FN:${card.full_name ?? ''}`,
      `N:${familyName};${givenName};;;`,
    ]
    if (card.company)     lines.push(`ORG:${card.company}`)
    if (card.title)       lines.push(`TITLE:${card.title}`)
    if (card.phone)       lines.push(`TEL;TYPE=CELL:${card.phone}`)
    if (card.email)       lines.push(`EMAIL;TYPE=INTERNET:${card.email}`)
    if (card.website)     lines.push(`URL:${card.website}`)
    if ((card as { address?: string }).address) lines.push(`ADR;TYPE=WORK:;;${(card as { address?: string }).address};;;;`)
    if (card.short_intro) lines.push(`NOTE:${card.short_intro.replace(/\n/g, '\\n')}`)
    lines.push(`X-AI-MEISHI:https://www.aimeishi.biz/card/${card.id}`)
    lines.push('END:VCARD')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${card.full_name ?? 'contact'}.vcf`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07060F' }}>
        <div className="w-10 h-10 border-3 rounded-full spin"
          style={{ border: '3px solid rgba(242,103,34,0.3)', borderTopColor: '#F5843A' }} />
      </div>
    )
  }

  if (cardDeleted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#07060F' }}>
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(242,103,34,0.1)', border: '1px solid rgba(242,103,34,0.2)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="3" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" />
            </svg>
          </div>
          <h2 className="font-black text-lg mb-2" style={{ color: '#FFF0E8' }}>この名刺は現在ご利用いただけません</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#6B4030' }}>
            担当者が名刺を削除または停止しました。<br />直接ご連絡いただくか、新しい名刺をお受け取りください。
          </p>
        </div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#07060F' }}>
        <div className="text-center" style={{ color: '#FFF0E8' }}>
          <div className="text-5xl mb-4">😕</div>
          <p className="font-bold">名刺が見つかりませんでした</p>
        </div>
      </div>
    )
  }

  const initial = card.full_name?.[0] || '?'

  // ── カスタムレイアウトレンダラー ─────────────────────────────────
  const layout = card.layout_json
  if (layout?.elements) {
    return (
      <CustomLayoutCard
        card={card}
        layout={layout}
        showAppt={showAppt}
        setShowAppt={setShowAppt}
        showNameInput={showNameInput}
        setShowNameInput={setShowNameInput}
        customerName={customerName}
        setCustomerName={setCustomerName}
        existingSession={existingSession}
        proceeding={proceeding}
        proceedToChat={proceedToChat}
        continueSession={continueSession}
        resetSession={resetSession}
        saveVCard={saveVCard}
        cardId={cardId}
      />
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(242,103,34,0.2) 0%, #07060F 60%)',
        backgroundColor: '#07060F',
      }}
    >
      <div className="w-full max-w-sm space-y-4">

        {/* ── デジタル名刺（プロフィール） ── */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: '#0F0E20', border: '1px solid rgba(242,103,34,0.15)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
        >
          {/* カードヘッダー */}
          <div className="relative flex items-center justify-between px-5 pt-5 pb-10"
            style={{ background: 'linear-gradient(135deg, rgba(242,103,34,0.2) 0%, rgba(99,71,240,0.1) 100%)' }}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: '#34D399', display: 'inline-block' }} />
              <span className="text-xs font-bold" style={{ color: '#34D399' }}>分身AI オンライン</span>
            </div>
          </div>

          {/* アバター＋プロフィール */}
          <div className="flex flex-col items-center -mt-8 px-5 pb-5">
            {card.profiles?.avatar_url ? (
              <div
                className="w-16 h-16 rounded-2xl mb-4 overflow-hidden"
                style={{
                  boxShadow: '0 0 0 3px rgba(242,103,34,0.3), 0 0 40px rgba(242,103,34,0.2)',
                  border: '2px solid rgba(242,103,34,0.4)',
                  flexShrink: 0,
                }}
              >
                <img
                  src={card.profiles.avatar_url}
                  alt={card.full_name ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl text-white mb-4"
                style={{
                  background: 'linear-gradient(135deg, #E05A18, #F5843A)',
                  boxShadow: '0 0 0 3px rgba(242,103,34,0.3), 0 0 40px rgba(242,103,34,0.2)',
                  border: '2px solid rgba(242,103,34,0.4)',
                }}
              >
                {initial}
              </div>
            )}

            <h1 className="text-xl font-bold text-center mb-1" style={{ color: '#FFF0E8' }}>{card.full_name}</h1>
            {card.title && (
              <p className="text-sm font-semibold text-center" style={{ color: '#F5843A' }}>{card.title}</p>
            )}
            {card.company && (
              <p className="text-xs text-center mt-0.5" style={{ color: '#6B4030' }}>{card.company}</p>
            )}

            {/* 自己紹介 */}
            {card.short_intro && (
              <div className="mt-4 w-full p-3.5 rounded-xl text-sm leading-relaxed"
                style={{ background: '#1C0F05', color: '#A08068', borderLeft: '3px solid rgba(242,103,34,0.5)' }}
              >
                {card.short_intro}
              </div>
            )}

            {/* 連絡先 */}
            <div className="mt-4 w-full space-y-2.5">
              {card.email && (
                <a href={`mailto:${card.email}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(242,103,34,0.12)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline truncate" style={{ color: '#A08068' }}>{card.email}</span>
                </a>
              )}
              {card.phone && (
                <a href={`tel:${card.phone}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(242,103,34,0.12)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline" style={{ color: '#A08068' }}>{card.phone}</span>
                </a>
              )}
              {card.website && (
                <a href={card.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(242,103,34,0.12)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <span className="text-sm group-hover:underline truncate" style={{ color: '#A08068' }}>
                    {card.website.replace(/https?:\/\//, '')}
                  </span>
                </a>
              )}
              {(card as { address?: string }).address && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(242,103,34,0.12)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <span className="text-sm" style={{ color: '#A08068' }}>{(card as { address?: string }).address}</span>
                </div>
              )}
            </div>

            {/* 連絡先を保存 */}
            {(card.email || card.phone) && (
              <button onClick={saveVCard}
                style={{
                  marginTop: 20, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 0', borderRadius: 14,
                  background: 'transparent', border: '1px solid rgba(242,103,34,0.3)',
                  color: '#F5843A', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(242,103,34,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                連絡先に保存
              </button>
            )}
          </div>
        </div>

        {/* ── アポイントフォーム（展開時） ── */}
        {showAppt && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#0F0E20', border: '1px solid rgba(242,103,34,0.25)' }}
          >
            <AppointmentForm
              cardId={cardId}
              ownerName={card.full_name || '担当者'}
              onClose={() => setShowAppt(false)}
            />
          </div>
        )}

        {/* ── CTAエリア ── */}
        {!showAppt && (
          <>
            {existingSession ? (
              <div className="space-y-3">
                <div className="rounded-2xl p-5"
                  style={{ background: '#0F0E20', border: '1px solid rgba(242,103,34,0.2)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #E05A18, #F5843A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: '#FFF0E8' }}>会話の続きがあります</p>
                      <p className="text-xs" style={{ color: '#6B4030' }}>
                        {existingSession.status === 'summarized' || existingSession.status === 'owner_chat'
                          ? 'AIとの対話が完了 · 本人への引き継ぎ準備ができています'
                          : 'AIとの対話が途中で終わっています'}
                      </p>
                    </div>
                  </div>
                  <button onClick={continueSession}
                    className="w-full py-3 mb-2 font-bold text-white rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #F5843A, #F59340)', boxShadow: '0 4px 20px rgba(242,103,34,0.4)', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    {existingSession.status === 'summarized' || existingSession.status === 'owner_chat'
                      ? '本人に直接話しかける →' : '続きから話す →'}
                  </button>
                  <button onClick={resetSession}
                    className="w-full text-center text-xs py-2"
                    style={{ color: '#6B4030', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >最初から相談する</button>
                </div>
                {/* アポイントボタンは常に表示 */}
                <button
                  onClick={() => setShowAppt(true)}
                  className="w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2"
                  style={{
                    background: 'transparent',
                    border: '1.5px solid rgba(242,103,34,0.4)',
                    color: '#F5843A', cursor: 'pointer',
                  } as React.CSSProperties}
                >
                  📅 アポイントを取る
                </button>
              </div>
            ) : !showNameInput ? (
              <div className="space-y-3">
                {/* メインCTA：分身AIに相談 */}
                <button
                  onClick={() => setShowNameInput(true)}
                  className="w-full py-5 text-lg font-bold text-white rounded-2xl flex items-center justify-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, #F5843A, #F59340)',
                    boxShadow: '0 8px 30px rgba(242,103,34,0.45)',
                    border: 'none', cursor: 'pointer', touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  本人の分身AIに相談する
                </button>

                {/* カスタムCTAボタン（成約への直接導線） */}
                {card.cta_url && card.cta_label && (
                  <a
                    href={card.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(242,103,34,0.15), rgba(242,103,34,0.25))',
                      border: '1.5px solid rgba(242,103,34,0.5)',
                      color: '#F5843A', textDecoration: 'none',
                      touchAction: 'manipulation', display: 'flex',
                    } as React.CSSProperties}
                  >
                    🎯 {card.cta_label}
                  </a>
                )}

                {/* サブCTA：アポイント */}
                <button
                  onClick={() => setShowAppt(true)}
                  className="w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2"
                  style={{
                    background: 'transparent',
                    border: '1.5px solid rgba(242,103,34,0.4)',
                    color: '#F5843A', cursor: 'pointer', touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  📅 アポイントを取る
                </button>

                {/* クイックボタン */}
                <div className="grid grid-cols-3 gap-2">
                  {['仕事を頼みたい', '話を聞いてみたい', '実績を知りたい'].map(text => (
                    <button key={text} onClick={() => setShowNameInput(true)}
                      className="text-xs font-medium py-2.5 px-2 rounded-2xl text-center"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#FFF0E8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                    >{text}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-5"
                style={{ background: '#0F0E20', border: '1px solid rgba(242,103,34,0.2)' }}
              >
                <h3 className="font-bold mb-1" style={{ color: '#FFF0E8' }}>お名前を教えてください</h3>
                <p className="text-xs mb-4" style={{ color: '#6B4030' }}>入力しなくても話せます。呼びかけてもらえると会話が自然になります</p>
                <input
                  type="text" value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && proceedToChat()}
                  placeholder="山田 花子"
                  style={{
                    width: '100%', background: '#1C0F05',
                    border: '1.5px solid rgba(242,103,34,0.2)', borderRadius: 12,
                    padding: '12px 16px', fontSize: '0.925rem', color: '#FFF0E8',
                    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(242,103,34,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(242,103,34,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(242,103,34,0.2)'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  onTouchEnd={e => { e.preventDefault(); proceedToChat() }}
                  onClick={proceedToChat} disabled={proceeding}
                  className="w-full py-3 font-bold text-white rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #F5843A, #F59340)',
                    boxShadow: '0 4px 20px rgba(242,103,34,0.4)', border: 'none',
                    cursor: proceeding ? 'not-allowed' : 'pointer',
                    opacity: proceeding ? 0.7 : 1, touchAction: 'manipulation',
                  } as React.CSSProperties}
                >
                  {proceeding ? '接続中...' : '話しかける →'}
                </button>
                <p style={{ textAlign: 'center', fontSize: 11, color: '#6B4030', marginTop: 8 }}>
                  🔓 登録不要・無料でご利用いただけます
                </p>
                <button onClick={() => setShowNameInput(false)}
                  className="w-full text-center text-sm py-2 mt-1"
                  style={{ color: '#6B4030', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >キャンセル</button>
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs" style={{ color: '#6B4030' }}>Powered by AI名刺</p>
      </div>
    </div>
  )
}

// ── カスタムレイアウトカード ────────────────────────────────────────
const CANVAS_W = 375
const CANVAS_H = 720

function CustomLayoutCard({ card, layout, showAppt, setShowAppt, showNameInput, setShowNameInput, customerName, setCustomerName, existingSession, proceeding, proceedToChat, continueSession, resetSession, saveVCard, cardId }: {
  card: CardPageData
  layout: CardLayout
  showAppt: boolean
  setShowAppt: (v: boolean) => void
  showNameInput: boolean
  setShowNameInput: (v: boolean) => void
  customerName: string
  setCustomerName: (v: string) => void
  existingSession: { id: string; status: string } | null
  proceeding: boolean
  proceedToChat: () => void
  continueSession: () => void
  resetSession: () => void
  saveVCard: () => void
  cardId: string
}) {
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth
        setScale(Math.min(1, w / CANVAS_W))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const els = layout.elements
  const get = (id: string) => els.find(e => e.id === id)
  const vis = (id: string) => get(id)?.visible !== false

  const elStyle = (id: string): React.CSSProperties => {
    const el = get(id)
    if (!el) return { display: 'none' }
    return {
      position: 'absolute',
      left: el.x, top: el.y, width: el.w, height: el.h,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }
  }

  if (showAppt) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#07060F' }}>
        <div className="w-full max-w-sm">
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0F0E20', border: '1px solid rgba(242,103,34,0.25)' }}>
            <AppointmentForm cardId={cardId} ownerName={card.full_name || '担当者'} onClose={() => setShowAppt(false)} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07060F', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, paddingBottom: 20 }}>
      <div ref={containerRef} style={{ width: '100%', maxWidth: CANVAS_W, padding: '0 0' }}>
        <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', margin: '0 auto' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: CANVAS_W, height: CANVAS_H,
            background: layout.bgColor ?? '#0F0E20',
            borderRadius: 28,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            overflow: 'hidden',
          }}>
            {/* グラデーション */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(242,103,34,0.2) 0%, transparent 60%)', pointerEvents: 'none' }} />

            {/* 分身AI バッジ */}
            <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399' }}>分身AI オンライン</span>
            </div>

            {/* 写真 */}
            {vis('avatar') && (
              <div style={{ ...elStyle('avatar'), borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 0 3px rgba(242,103,34,0.3)' }}>
                {card.profiles?.avatar_url
                  ? <img src={card.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#E05A18,#F5843A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: get('avatar')!.h * 0.4, fontWeight: 900, color: 'white' }}>{card.full_name?.[0]}</div>
                }
              </div>
            )}

            {/* 氏名 */}
            {vis('name') && card.full_name && (
              <div style={elStyle('name')}>
                <p style={{ margin: 0, color: '#FFF0E8', fontWeight: 900, fontSize: get('name')?.fontSize ?? 22, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.full_name}</p>
              </div>
            )}

            {/* 肩書き */}
            {vis('title') && card.title && (
              <div style={elStyle('title')}>
                <p style={{ margin: 0, color: '#F5843A', fontWeight: 600, fontSize: get('title')?.fontSize ?? 15, lineHeight: 1.3 }}>{card.title}</p>
              </div>
            )}

            {/* 会社名 */}
            {vis('company') && card.company && (
              <div style={elStyle('company')}>
                <p style={{ margin: 0, color: '#6B4030', fontSize: get('company')?.fontSize ?? 13, lineHeight: 1.3 }}>{card.company}</p>
              </div>
            )}

            {/* 自己紹介 */}
            {vis('intro') && card.short_intro && (
              <div style={{ ...elStyle('intro'), borderLeft: '3px solid rgba(242,103,34,0.5)', paddingLeft: 10, background: 'rgba(28,15,5,0.5)', borderRadius: '0 8px 8px 0' }}>
                <p style={{ margin: 0, color: '#A08068', fontSize: get('intro')?.fontSize ?? 13, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const }}>{card.short_intro}</p>
              </div>
            )}

            {/* メール */}
            {vis('email') && card.email && (
              <div style={elStyle('email')}>
                <a href={`mailto:${card.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', textDecoration: 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(242,103,34,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </div>
                  <span style={{ color: '#A08068', fontSize: get('email')?.fontSize ?? 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.email}</span>
                </a>
              </div>
            )}

            {/* 電話 */}
            {vis('phone') && card.phone && (
              <div style={elStyle('phone')}>
                <a href={`tel:${card.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', textDecoration: 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(242,103,34,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/></svg>
                  </div>
                  <span style={{ color: '#A08068', fontSize: get('phone')?.fontSize ?? 13 }}>{card.phone}</span>
                </a>
              </div>
            )}

            {/* ウェブサイト */}
            {vis('website') && card.website && (
              <div style={elStyle('website')}>
                <a href={card.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', textDecoration: 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(242,103,34,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F5843A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <span style={{ color: '#A08068', fontSize: get('website')?.fontSize ?? 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.website.replace(/https?:\/\//, '')}</span>
                </a>
              </div>
            )}

            {/* 連絡先を保存 */}
            {vis('save_contact') && (card.email || card.phone) && (
              <div style={elStyle('save_contact')}>
                <button onClick={saveVCard} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(242,103,34,0.3)', borderRadius: 12, color: '#F5843A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  連絡先に保存
                </button>
              </div>
            )}

            {/* AI相談ボタン */}
            {vis('ai_button') && (
              <div style={elStyle('ai_button')}>
                {existingSession ? (
                  <button onClick={continueSession} style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#F5843A,#F59340)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(242,103,34,0.4)' }}>
                    続きから話す →
                  </button>
                ) : showNameInput ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input
                        type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && proceedToChat()}
                        placeholder="お名前（任意）"
                        style={{ flex: 1, background: 'rgba(28,15,5,0.8)', border: '1.5px solid rgba(242,103,34,0.3)', borderRadius: 10, padding: '0 12px', color: '#FFF0E8', fontSize: 13, outline: 'none' }}
                      />
                      <button onClick={proceedToChat} disabled={proceeding}
                        style={{ padding: '0 14px', background: 'linear-gradient(135deg,#F5843A,#F59340)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {proceeding ? '...' : '話す →'}
                      </button>
                    </div>
                    <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,240,232,0.5)', margin: 0 }}>
                      🔓 登録不要・無料でご利用いただけます
                    </p>
                  </div>
                ) : (
                  <button onClick={() => setShowNameInput(true)} style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#F5843A,#F59340)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(242,103,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    本人の分身AIに相談する
                  </button>
                )}
              </div>
            )}

            {/* CTA */}
            {vis('cta_button') && card.cta_url && card.cta_label && (
              <div style={elStyle('cta_button')}>
                <a href={card.cta_url} target="_blank" rel="noopener noreferrer"
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(242,103,34,0.15)', border: '1.5px solid rgba(242,103,34,0.5)', borderRadius: 12, color: '#F5843A', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  🎯 {card.cta_label}
                </a>
              </div>
            )}

            {/* アポイント */}
            {vis('appt_button') && (
              <div style={elStyle('appt_button')}>
                <button onClick={() => setShowAppt(true)}
                  style={{ width: '100%', height: '100%', background: 'transparent', border: '1.5px solid rgba(242,103,34,0.4)', borderRadius: 12, color: '#F5843A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  📅 アポイントを取る
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#3D2010', marginTop: 12 }}>Powered by AI名刺</p>
    </div>
  )
}
