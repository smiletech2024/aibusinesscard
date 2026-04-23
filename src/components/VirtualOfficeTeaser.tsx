'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Slot {
  area: 'kanto' | 'kansai'
  floor_num: number
  slot_num: number
  user_id: string | null
  card_id: string | null
  company_name: string | null
}

const AREAS = [
  { id: 'kanto',  label: '関東',  city: '東京',  flag: '🗼' },
  { id: 'kansai', label: '関西',  city: '大阪',  flag: '🏯' },
] as const

export default function VirtualOfficeTeaser() {
  const [slots, setSlots]           = useState<Slot[]>([])
  const [area, setArea]             = useState<'kanto' | 'kansai'>('kanto')
  const [loaded, setLoaded]         = useState(false)

  useEffect(() => {
    fetch('/api/virtual-office')
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const get = (floor: number, slot: number) =>
    slots.find(s => s.area === area && s.floor_num === floor && s.slot_num === slot)

  const total    = slots.filter(s => s.user_id).length
  const occupied = slots.filter(s => s.area === area && s.user_id).length
  const vacant   = 21 - occupied

  return (
    <div
      className="w-full max-w-3xl mb-24 rounded-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #1A0B03 0%, #2C1508 100%)',
        boxShadow: '0 20px 60px rgba(28,15,5,0.45)',
      }}
    >
      {/* ── 上部：コピー ── */}
      <div className="px-6 pt-8 pb-6 sm:px-10 sm:pt-10">
        {/* バッジ */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5"
          style={{ background: 'rgba(232,96,28,0.18)', color: '#F5903A', border: '1px solid rgba(232,96,28,0.3)', letterSpacing: '0.05em' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8601C', display: 'inline-block', boxShadow: '0 0 8px #E8601C' }} />
          バーチャルオフィス · 先着無料
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2
              className="font-black mb-2 leading-tight"
              style={{ fontSize: 'clamp(22px, 5vw, 34px)', color: '#FBF4EC' }}
            >
              名刺を渡していない人も、<br />
              <span style={{ background: 'linear-gradient(120deg,#E8601C,#F5903A,#C4883A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                あなたを訪ねてこられる。
              </span>
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'rgba(251,244,236,0.6)', maxWidth: 380 }}
            >
              バーチャルオフィスは、誰でも覗けるビジネス街。<br />
              QRコードがなくても、ここから窓口を開けます。
            </p>
          </div>

          {/* ライブ統計 */}
          {loaded && (
            <div
              className="flex gap-4 flex-shrink-0"
              style={{ borderLeft: '1px solid rgba(196,136,58,0.2)', paddingLeft: 20 }}
            >
              <div className="text-center">
                <div className="font-black text-2xl" style={{ color: '#E8601C', lineHeight: 1 }}>{total}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(251,244,236,0.4)' }}>入居中</div>
              </div>
              <div className="text-center">
                <div className="font-black text-2xl" style={{ color: '#C4883A', lineHeight: 1 }}>{42 - total}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(251,244,236,0.4)' }}>空き室</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ビル ── */}
      <div className="px-4 pb-4 sm:px-6">
        {/* エリアタブ */}
        <div
          className="flex rounded-xl p-0.5 mb-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(196,136,58,0.1)' }}
        >
          {AREAS.map(a => (
            <button
              key={a.id}
              onClick={() => setArea(a.id)}
              style={{
                flex: 1, padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: area === a.id ? 'rgba(232,96,28,0.2)' : 'transparent',
                color: area === a.id ? '#F5903A' : 'rgba(251,244,236,0.35)',
                border: area === a.id ? '1px solid rgba(232,96,28,0.3)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {a.flag} {a.label}エリア
              <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>
                ({area === a.id ? occupied : slots.filter(s => s.area === a.id && s.user_id).length}/21)
              </span>
            </button>
          ))}
        </div>

        {/* ビル可視化 */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(196,136,58,0.1)' }}
        >
          {/* ビル名板 */}
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(196,136,58,0.08)', background: 'rgba(0,0,0,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14 }}>{AREAS.find(a2 => a2.id === area)?.flag}</span>
              <span className="font-black text-xs" style={{ color: 'rgba(251,244,236,0.7)', letterSpacing: '0.08em' }}>
                {AREAS.find(a2 => a2.id === area)?.label}ビル
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(196,136,58,0.12)', color: '#C4883A', fontSize: 10 }}>
                {AREAS.find(a2 => a2.id === area)?.city}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: vacant > 0 ? '#22C55E' : '#EF4444', display: 'inline-block', boxShadow: vacant > 0 ? '0 0 6px #22C55E' : '0 0 6px #EF4444' }} />
              <span className="text-xs font-bold" style={{ color: vacant > 0 ? '#22C55E' : '#EF4444' }}>
                空き {vacant} 室
              </span>
            </div>
          </div>

          {/* フロア × スロット グリッド */}
          <div className="p-3">
            {[7, 6, 5, 4, 3, 2, 1].map(floor => (
              <div key={floor} className="flex items-stretch gap-1.5 mb-1.5">
                {/* フロアラベル */}
                <div
                  className="flex items-center justify-center flex-shrink-0 rounded-lg"
                  style={{ width: 30, background: 'rgba(196,136,58,0.06)' }}
                >
                  <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(196,136,58,0.5)', letterSpacing: '0.05em' }}>{floor}F</span>
                </div>

                {/* 3スロット */}
                {[1, 2, 3].map(sn => {
                  const slot = get(floor, sn)
                  const isOccupied = !!slot?.user_id
                  return (
                    <div
                      key={sn}
                      className="flex-1 rounded-xl flex flex-col justify-between overflow-hidden"
                      style={{
                        minHeight: 56,
                        background: isOccupied
                          ? 'linear-gradient(135deg, rgba(251,244,236,0.97), rgba(240,228,208,0.95))'
                          : 'rgba(255,255,255,0.025)',
                        border: isOccupied
                          ? '1px solid rgba(196,136,58,0.3)'
                          : '1px dashed rgba(255,255,255,0.06)',
                        boxShadow: isOccupied ? '0 2px 12px rgba(232,96,28,0.12), inset 0 1px 0 rgba(255,255,255,0.8)' : 'none',
                        padding: isOccupied ? '7px 8px' : '6px 6px',
                        transition: 'all 0.3s',
                      }}
                    >
                      {isOccupied && slot ? (
                        <>
                          <div>
                            <p style={{ fontSize: 9, fontWeight: 900, color: '#1C0F05', lineHeight: 1.3, marginBottom: 1 }}>
                              {slot.company_name || '入居中'}
                            </p>
                          </div>
                          {slot.card_id ? (
                            <Link
                              href={`/card/${slot.card_id}`}
                              style={{
                                display: 'block', textAlign: 'center', fontSize: 8, fontWeight: 800,
                                padding: '3px 4px', borderRadius: 4,
                                background: '#E8601C', color: 'white', textDecoration: 'none',
                              }}
                            >
                              窓口
                            </Link>
                          ) : (
                            <div style={{ height: 16 }} />
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div style={{
                            width: 16, height: 16, borderRadius: 3,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px dashed rgba(255,255,255,0.08)',
                          }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* 凡例 */}
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(196,136,58,0.08)', background: 'rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(135deg,#FBF4EC,#F0E4D0)', border: '1px solid rgba(196,136,58,0.3)' }} />
                <span style={{ fontSize: 9, color: 'rgba(251,244,236,0.4)' }}>入居中</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 10, height: 10, borderRadius: 2, border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />
                <span style={{ fontSize: 9, color: 'rgba(251,244,236,0.4)' }}>空き</span>
              </div>
            </div>
            <span style={{ fontSize: 9, color: 'rgba(196,136,58,0.4)' }}>リアルタイム更新</span>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-6 pb-8 sm:px-10 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(251,244,236,0.4)', maxWidth: 300 }}>
          今なら先着無料。窓口を開くだけで、<br />
          知らない誰かがあなたのAIと話しはじめます。
        </p>
        <div className="flex gap-3 flex-shrink-0">
          <Link
            href="/virtual-office"
            className="font-bold px-6 py-3 rounded-xl text-sm transition hover:opacity-90"
            style={{ background: '#E8601C', color: 'white', textDecoration: 'none', boxShadow: '0 4px 18px rgba(232,96,28,0.4)', whiteSpace: 'nowrap' }}
          >
            ビルを覗く →
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold px-5 py-3 rounded-xl text-sm transition hover:opacity-80"
            style={{ color: 'rgba(251,244,236,0.6)', border: '1px solid rgba(196,136,58,0.2)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            入居する
          </Link>
        </div>
      </div>
    </div>
  )
}
