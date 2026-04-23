'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'

interface Slot {
  id: string
  area: 'kanto' | 'kansai'
  floor_num: number
  slot_num: number
  user_id: string | null
  card_id: string | null
  company_name: string | null
  display_name: string | null
  card_title: string | null
  occupied_at: string | null
}

interface Card {
  id: string
  company: string
  title: string
}

const AREA_CONFIG = {
  kanto:  { label: '関東エリア', city: '東京', flag: '🗼' },
  kansai: { label: '関西エリア', city: '大阪', flag: '🏯' },
} as const

export default function VirtualOfficePage() {
  const router = useRouter()
  const supabase = createClient()

  const [slots, setSlots]             = useState<Slot[]>([])
  const [activeArea, setActiveArea]   = useState<'kanto' | 'kansai'>('kanto')
  const [userId, setUserId]           = useState<string | null>(null)
  const [myCards, setMyCards]         = useState<Card[]>([])
  const [mySlot, setMySlot]           = useState<Slot | null>(null)
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(false)

  // Claim modal
  const [claimTarget, setClaimTarget] = useState<Slot | null>(null)
  const [selectedCardId, setSelectedCardId] = useState('')

  // Release confirm
  const [showRelease, setShowRelease] = useState(false)

  const loadSlots = async () => {
    const res  = await fetch('/api/virtual-office')
    const data = await res.json()
    return (data.slots ?? []) as Slot[]
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const allSlots = await loadSlots()
      setSlots(allSlots)

      if (user) {
        const { data: cards } = await supabase
          .from('business_cards')
          .select('id, company, title')
          .eq('user_id', user.id)
          .eq('is_active', true)
        setMyCards(cards ?? [])
        if (cards && cards.length > 0) setSelectedCardId(cards[0].id)

        const mine = allSlots.find(s => s.user_id === user.id)
        setMySlot(mine ?? null)
      }
      setLoading(false)
    }
    init()
  }, [])

  const refresh = async () => {
    const allSlots = await loadSlots()
    setSlots(allSlots)
    const mine = userId ? allSlots.find(s => s.user_id === userId) : null
    setMySlot(mine ?? null)
  }

  const handleClaimClick = (slot: Slot) => {
    if (!userId) { router.push('/auth/login'); return }
    if (mySlot) { return }  // すでに入居中
    setClaimTarget(slot)
  }

  const handleClaim = async () => {
    if (!claimTarget || !selectedCardId) return
    setBusy(true)
    try {
      const res = await fetch('/api/virtual-office/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: claimTarget.id, card_id: selectedCardId }),
      })
      const data = await res.json()
      if (res.ok) {
        await refresh()
        setClaimTarget(null)
      } else {
        alert(data.error ?? '入居に失敗しました')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleRelease = async () => {
    if (!mySlot) return
    setBusy(true)
    try {
      await fetch('/api/virtual-office/claim', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: mySlot.id }),
      })
      await refresh()
      setShowRelease(false)
    } finally {
      setBusy(false)
    }
  }

  const getSlot = (area: 'kanto' | 'kansai', floor: number, slotNum: number) =>
    slots.find(s => s.area === area && s.floor_num === floor && s.slot_num === slotNum)

  const occupiedTotal  = slots.filter(s => s.user_id).length
  const occupiedKanto  = slots.filter(s => s.area === 'kanto'  && s.user_id).length
  const occupiedKansai = slots.filter(s => s.area === 'kansai' && s.user_id).length
  const areaOccupied   = activeArea === 'kanto' ? occupiedKanto : occupiedKansai
  const areaVacant     = 21 - areaOccupied

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF5F0' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(232,96,28,0.25)', borderTopColor: '#E8601C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const area = AREA_CONFIG[activeArea]

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0' }}>

      {/* ── Header ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #EDD9C8', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {/* ロゴ or 戻るボタン */}
          {userId ? (
            <button
              onClick={() => router.push('/dashboard')}
              style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF5F0', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : (
            <Link href="/" style={{ flexShrink: 0 }}>
              <Logo size={28} variant="dark" />
            </Link>
          )}
          <div className="flex-1">
            <h1 className="font-black text-base" style={{ color: '#1C0F05' }}>バーチャルオフィス</h1>
            <p className="text-xs" style={{ color: '#A08068' }}>
              入居中 {occupiedTotal} / 42 社 · 今なら先着無料
            </p>
          </div>
          {mySlot ? (
            <div
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(232,96,28,0.1)', color: '#E8601C', border: '1px solid rgba(232,96,28,0.25)' }}
            >
              入居中
            </div>
          ) : !userId ? (
            <Link
              href="/auth/login"
              className="text-xs font-bold px-4 py-2 rounded-full"
              style={{ background: '#E8601C', color: 'white', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              入居する
            </Link>
          ) : null}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── 自分のスロット通知 ── */}
        {mySlot && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'linear-gradient(135deg,rgba(232,96,28,0.08),rgba(232,96,28,0.12))', border: '1.5px solid rgba(232,96,28,0.25)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold mb-0.5" style={{ color: '#E8601C' }}>
                  {AREA_CONFIG[mySlot.area].label} · {mySlot.floor_num}F · {mySlot.slot_num}番
                </p>
                <p className="font-black text-sm" style={{ color: '#1C0F05' }}>{mySlot.company_name || '（社名未設定）'}</p>
                <p className="text-xs" style={{ color: '#7A4A28' }}>{mySlot.display_name} {mySlot.card_title && `/ ${mySlot.card_title}`}</p>
              </div>
              <button
                onClick={() => setShowRelease(true)}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: 'none', border: '1.5px solid #DEC4AD', color: '#A08068', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                退去する
              </button>
            </div>
          </div>
        )}

        {/* ── エリアタブ ── */}
        <div
          className="flex rounded-2xl p-1"
          style={{ background: 'rgba(196,136,58,0.08)', border: '1px solid rgba(196,136,58,0.15)' }}
        >
          {(['kanto', 'kansai'] as const).map(a => (
            <button
              key={a}
              onClick={() => setActiveArea(a)}
              style={{
                flex: 1, padding: '10px', borderRadius: 14, fontSize: 13, fontWeight: 700,
                background: activeArea === a ? '#E8601C' : 'transparent',
                color: activeArea === a ? 'white' : '#7A4A28',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {AREA_CONFIG[a].flag} {AREA_CONFIG[a].label}
              <span
                className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeArea === a ? 'rgba(255,255,255,0.25)' : 'rgba(196,136,58,0.15)',
                  color: activeArea === a ? 'white' : '#A08068',
                }}
              >
                {a === 'kanto' ? occupiedKanto : occupiedKansai}/21
              </span>
            </button>
          ))}
        </div>

        {/* ── ビル ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#1C0F05', boxShadow: '0 8px 40px rgba(28,15,5,0.4)' }}
        >
          {/* ビルヘッダー */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(196,136,58,0.15)', background: 'rgba(0,0,0,0.3)' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 18 }}>{area.flag}</span>
                <span className="font-black text-base" style={{ color: '#FBF4EC' }}>{area.label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(196,136,58,0.2)', color: '#C4883A' }}>{area.city}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(251,244,236,0.5)' }}>7階建 · 各フロア3室</p>
            </div>
            <div className="text-right">
              <div className="font-black text-lg" style={{ color: '#E8601C' }}>{areaVacant}<span className="text-xs font-normal ml-1" style={{ color: 'rgba(251,244,236,0.5)' }}>室空き</span></div>
            </div>
          </div>

          {/* フロア一覧（7F → 1F） */}
          <div>
            {[7, 6, 5, 4, 3, 2, 1].map(floor => (
              <div
                key={floor}
                className="flex items-stretch"
                style={{ borderBottom: floor > 1 ? '1px solid rgba(196,136,58,0.08)' : 'none' }}
              >
                {/* フロアラベル */}
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 40, background: 'rgba(0,0,0,0.2)' }}
                >
                  <span className="font-black text-xs" style={{ color: '#C4883A', letterSpacing: '0.05em', writingMode: 'horizontal-tb' }}>
                    {floor}F
                  </span>
                </div>

                {/* 3スロット */}
                <div className="flex-1 grid grid-cols-3" style={{ gap: '1px', background: 'rgba(196,136,58,0.08)' }}>
                  {[1, 2, 3].map(slotNum => {
                    const slot = getSlot(activeArea, floor, slotNum)
                    const isMySlot = slot?.user_id === userId && userId !== null
                    const occupied = !!slot?.user_id

                    return (
                      <div
                        key={slotNum}
                        style={{
                          background: occupied
                            ? isMySlot ? 'rgba(232,96,28,0.12)' : '#FBF4EC'
                            : 'rgba(255,255,255,0.02)',
                          padding: '10px 8px',
                          minHeight: 84,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative',
                        }}
                      >
                        {occupied && slot ? (
                          <>
                            {isMySlot && (
                              <div
                                style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#E8601C' }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <p
                                className="font-black leading-tight mb-0.5"
                                style={{ fontSize: 11, color: '#1C0F05', lineHeight: 1.3 }}
                              >
                                {slot.company_name || '（社名）'}
                              </p>
                              <p style={{ fontSize: 10, color: '#7A4A28', lineHeight: 1.3 }}>
                                {slot.display_name || ''}
                              </p>
                              {slot.card_title && (
                                <p style={{ fontSize: 9, color: '#A08068', marginTop: 1 }}>{slot.card_title}</p>
                              )}
                            </div>
                            {slot.card_id && (
                              <Link
                                href={`/card/${slot.card_id}`}
                                className="block text-center font-bold rounded-lg mt-2"
                                style={{ fontSize: 10, padding: '4px 6px', background: '#E8601C', color: 'white', textDecoration: 'none' }}
                              >
                                窓口を開く
                              </Link>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center flex-1">
                              <span
                                className="font-bold"
                                style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', border: '1px dashed rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}
                              >
                                空き
                              </span>
                            </div>
                            {userId && !mySlot && slot && (
                              <button
                                onClick={() => handleClaimClick(slot)}
                                style={{ fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 6, background: 'rgba(232,96,28,0.15)', color: '#E8601C', border: '1px solid rgba(232,96,28,0.3)', cursor: 'pointer', marginTop: 4 }}
                              >
                                入居する
                              </button>
                            )}
                            {!userId && (
                              <Link
                                href="/auth/login"
                                className="block text-center font-bold rounded-lg mt-2"
                                style={{ fontSize: 10, padding: '4px 0', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', textDecoration: 'none', borderRadius: 6 }}
                              >
                                ログイン
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ビルフッター */}
          <div
            className="px-5 py-3 text-center"
            style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(196,136,58,0.1)' }}
          >
            <p style={{ fontSize: 10, color: 'rgba(251,244,236,0.35)' }}>
              現在先着無料 · 今後レンタル料が発生する予定です
            </p>
          </div>
        </div>

        {/* ── 案内 ── */}
        {!mySlot && userId && (
          <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #EDD9C8' }}>
            <h3 className="font-black text-sm mb-1" style={{ color: '#1C0F05' }}>入居するには</h3>
            <ol className="space-y-1">
              {['空いているスロットの「入居する」をタップ', '使う名刺を選んで確定', '窓口ボタンがあなたのAI名刺に繋がります'].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#7A4A28' }}>
                  <span className="font-black flex-shrink-0" style={{ color: '#E8601C' }}>{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        )}

        {!userId && (
          <div className="rounded-2xl p-4 text-center" style={{ background: 'white', border: '1px solid #EDD9C8' }}>
            <p className="text-sm font-bold mb-3" style={{ color: '#1C0F05' }}>ログインすると入居できます</p>
            <Link
              href="/auth/login"
              className="inline-block font-bold px-6 py-2.5 rounded-xl text-sm"
              style={{ background: '#E8601C', color: 'white', textDecoration: 'none' }}
            >
              無料でログイン →
            </Link>
          </div>
        )}

      </div>

      {/* ── 入居モーダル ── */}
      {claimTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setClaimTarget(null) }}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl p-6"
            style={{ background: 'white', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#DEC4AD' }} />
            <h3 className="font-black text-lg mb-1" style={{ color: '#1C0F05' }}>この部屋に入居する</h3>
            <p className="text-sm mb-5" style={{ color: '#A08068' }}>
              {AREA_CONFIG[claimTarget.area].label} · {claimTarget.floor_num}F · {claimTarget.slot_num}番
            </p>

            {myCards.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-bold mb-2" style={{ color: '#4A2C1A' }}>
                  窓口に使う名刺を選ぶ
                </label>
                <div className="space-y-2">
                  {myCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10,
                        border: selectedCardId === card.id ? '2px solid #E8601C' : '1.5px solid #DEC4AD',
                        background: selectedCardId === card.id ? 'rgba(232,96,28,0.05)' : 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="font-bold text-sm" style={{ color: '#1C0F05' }}>{card.company || '（社名なし）'}</div>
                      <div className="text-xs" style={{ color: '#A08068' }}>{card.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {myCards.length === 1 && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: '#FAF5F0', border: '1px solid #EDD9C8' }}>
                <p className="text-xs font-bold mb-0.5" style={{ color: '#A08068' }}>窓口に表示される情報</p>
                <p className="font-black text-sm" style={{ color: '#1C0F05' }}>{myCards[0].company || '（社名なし）'}</p>
                <p className="text-xs" style={{ color: '#7A4A28' }}>{myCards[0].title}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setClaimTarget(null)}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #DEC4AD', background: '#FAF5F0', color: '#7A4A28', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleClaim}
                disabled={busy || !selectedCardId}
                style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: busy ? '#DEC4AD' : 'linear-gradient(135deg,#E8601C,#F5903A)', color: 'white', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', boxShadow: busy ? 'none' : '0 4px 14px rgba(232,96,28,0.3)' }}
              >
                {busy ? '入居中...' : 'この部屋に入居する →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 退去確認モーダル ── */}
      {showRelease && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setShowRelease(false) }}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl p-6"
            style={{ background: 'white', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#DEC4AD' }} />
            <h3 className="font-black text-lg mb-2" style={{ color: '#1C0F05' }}>退去しますか？</h3>
            <p className="text-sm mb-6" style={{ color: '#A08068' }}>
              退去するとスロットが空きになります。別の人が入居できるようになります。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRelease(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #DEC4AD', background: '#FAF5F0', color: '#7A4A28', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleRelease}
                disabled={busy}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: busy ? '#DEC4AD' : '#EF4444', color: 'white', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? '処理中...' : '退去する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
