'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CANVAS_W = 375
const CANVAS_H = 720

export type ElId =
  | 'avatar' | 'name' | 'title' | 'company' | 'intro'
  | 'email' | 'phone' | 'website' | 'save_contact'
  | 'ai_button' | 'cta_button' | 'appt_button'

export interface LayoutEl {
  id: ElId
  label: string
  x: number
  y: number
  w: number
  h: number
  fontSize?: number
  visible: boolean
}

export interface CardLayout {
  version: number
  elements: LayoutEl[]
  bgColor: string
}

export const LAYOUT_DEFAULTS: LayoutEl[] = [
  { id: 'avatar',       label: '📷 写真',       x: 148, y: 30,  w: 80,  h: 80,  visible: true },
  { id: 'name',         label: '👤 氏名',        x: 20,  y: 130, w: 335, h: 40,  fontSize: 22, visible: true },
  { id: 'title',        label: '💼 肩書き',      x: 20,  y: 176, w: 335, h: 28,  fontSize: 15, visible: true },
  { id: 'company',      label: '🏢 会社名',      x: 20,  y: 210, w: 335, h: 24,  fontSize: 13, visible: true },
  { id: 'intro',        label: '📝 自己紹介',    x: 20,  y: 250, w: 335, h: 72,  fontSize: 13, visible: true },
  { id: 'email',        label: '✉️ メール',      x: 20,  y: 338, w: 335, h: 36,  fontSize: 13, visible: true },
  { id: 'phone',        label: '📞 電話',        x: 20,  y: 380, w: 335, h: 36,  fontSize: 13, visible: true },
  { id: 'website',      label: '🌐 ウェブサイト', x: 20,  y: 422, w: 335, h: 36,  fontSize: 13, visible: true },
  { id: 'save_contact', label: '💾 連絡先を保存', x: 20,  y: 474, w: 335, h: 40,  visible: true },
  { id: 'ai_button',   label: '🤖 AI相談ボタン', x: 20,  y: 530, w: 335, h: 52,  visible: true },
  { id: 'cta_button',  label: '🎯 CTAボタン',   x: 20,  y: 594, w: 335, h: 44,  visible: true },
  { id: 'appt_button', label: '📅 アポイント',   x: 20,  y: 648, w: 335, h: 44,  visible: true },
]

const BG_PRESETS = [
  { label: 'ダーク',     color: '#0F0E20' },
  { label: 'ブラック',   color: '#07060F' },
  { label: 'ネイビー',   color: '#0A1628' },
  { label: 'グリーン',   color: '#0A1F0F' },
  { label: 'ワイン',     color: '#1A0A14' },
  { label: 'チャコール', color: '#1A1A2E' },
  { label: 'ホワイト',   color: '#FFFFFF' },
  { label: 'クリーム',   color: '#FAF5F0' },
]

export default function CardEditorPage() {
  const params  = useParams()
  const router  = useRouter()
  const cardId  = params.cardId as string
  const supabase = createClient()

  const [loading,    setLoading]    = useState(true)
  const [elements,   setElements]   = useState<LayoutEl[]>(LAYOUT_DEFAULTS)
  const [selectedId, setSelectedId] = useState<ElId | null>(null)
  const [bgColor,    setBgColor]    = useState('#0F0E20')
  const [saving,     setSaving]     = useState(false)
  const [scale,      setScale]      = useState(1)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    type: 'move' | 'resize'
    id: ElId
    startPx: number; startPy: number
    startEx: number; startEy: number
    startEw: number; startEh: number
    scale: number
  } | null>(null)

  // スケール計算
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth - 8
        setScale(Math.min(1, w / CANVAS_W))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // カード・レイアウト読み込み
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('business_cards')
        .select('layout_json')
        .eq('id', cardId)
        .single()
      if (data?.layout_json?.elements) {
        setElements(data.layout_json.elements)
        setBgColor(data.layout_json.bgColor ?? '#0F0E20')
      }
      setLoading(false)
    })()
  }, [cardId])

  const updateEl = (id: ElId, patch: Partial<LayoutEl>) =>
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el))

  const handleMoveStart = (e: React.PointerEvent, id: ElId) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedId(id)
    const el = elements.find(x => x.id === id)!
    dragRef.current = { type: 'move', id, startPx: e.clientX, startPy: e.clientY, startEx: el.x, startEy: el.y, startEw: el.w, startEh: el.h, scale }
  }

  const handleResizeStart = (e: React.PointerEvent, id: ElId) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const el = elements.find(x => x.id === id)!
    dragRef.current = { type: 'resize', id, startPx: e.clientX, startPy: e.clientY, startEx: el.x, startEy: el.y, startEw: el.w, startEh: el.h, scale }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startPx) / d.scale
    const dy = (e.clientY - d.startPy) / d.scale
    if (d.type === 'move') {
      updateEl(d.id, {
        x: Math.round(Math.max(0, Math.min(CANVAS_W - 40, d.startEx + dx))),
        y: Math.round(Math.max(0, d.startEy + dy)),
      })
    } else {
      updateEl(d.id, {
        w: Math.round(Math.max(60,  Math.min(CANVAS_W - d.startEx, d.startEw + dx))),
        h: Math.round(Math.max(24,  d.startEh + dy)),
      })
    }
  }

  const handlePointerUp = () => { dragRef.current = null }

  const save = async () => {
    setSaving(true)
    const layout: CardLayout = { version: 1, elements, bgColor }
    await supabase.from('business_cards').update({ layout_json: layout }).eq('id', cardId)
    setSaving(false)
    router.push('/dashboard')
  }

  const reset = () => {
    if (!confirm('レイアウトをデフォルトに戻しますか？')) return
    setElements(LAYOUT_DEFAULTS)
    setBgColor('#0F0E20')
  }

  const selectedEl = elements.find(el => el.id === selectedId) ?? null

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF5F0' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #EDD9C8', borderTopColor: '#F26722', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0' }}>

      {/* ヘッダー */}
      <header style={{
        background: 'white', borderBottom: '1px solid #EDD9C8',
        padding: '0 16px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#A08068', cursor: 'pointer', fontSize: 13 }}>
          ← 戻る
        </button>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1C0F05' }}>レイアウト編集</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={reset}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, background: 'transparent', border: '1px solid #EDD9C8', color: '#A08068', cursor: 'pointer' }}>
            リセット
          </button>
          <button onClick={save} disabled={saving}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: 'white', background: saving ? '#F5C09A' : 'linear-gradient(135deg, #F26722, #F59340)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>

      <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
        {/* ヒント */}
        <p style={{ fontSize: 11, color: '#A08068', textAlign: 'center', marginBottom: 12 }}>
          ドラッグで移動 · 右下の■でリサイズ · タップして選択
        </p>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── キャンバス ── */}
          <div ref={containerRef} style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', margin: '0 auto' }}>
              <div
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: CANVAS_W, height: CANVAS_H,
                  background: bgColor,
                  borderRadius: 28,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  touchAction: 'none',
                  overflow: 'hidden',
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={() => setSelectedId(null)}
              >
                {/* 上部グラデーション */}
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(242,103,34,0.22) 0%, transparent 60%)', pointerEvents: 'none' }} />

                {/* 要素 */}
                {elements.map(el => (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: el.x, top: el.y, width: el.w, height: el.h,
                      opacity: el.visible ? 1 : 0.18,
                      cursor: 'move',
                      border: selectedId === el.id ? '2px solid #F26722' : '1.5px dashed rgba(255,255,255,0.22)',
                      borderRadius: 10,
                      background: selectedId === el.id ? 'rgba(242,103,34,0.2)' : 'rgba(255,255,255,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxSizing: 'border-box',
                      userSelect: 'none', touchAction: 'none',
                      zIndex: selectedId === el.id ? 10 : 1,
                    }}
                    onPointerDown={e => handleMoveStart(e, el.id)}
                    onClick={e => { e.stopPropagation(); setSelectedId(el.id) }}
                  >
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 700, textAlign: 'center', pointerEvents: 'none', padding: '0 4px', lineHeight: 1.3 }}>
                      {el.label}
                      {el.fontSize ? `\n${el.fontSize}px` : ''}
                    </span>

                    {/* リサイズハンドル */}
                    <div
                      style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 16, height: 16,
                        background: selectedId === el.id ? '#F26722' : 'rgba(255,255,255,0.35)',
                        cursor: 'se-resize', borderRadius: '3px 0 8px 0',
                        touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onPointerDown={e => { e.stopPropagation(); handleResizeStart(e, el.id) }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" style={{ pointerEvents: 'none' }}>
                        <path d="M1 7L7 1M4 7L7 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>

                    {/* 座標表示（選択中） */}
                    {selectedId === el.id && (
                      <div style={{ position: 'absolute', top: -20, left: 0, fontSize: 9, color: '#F26722', fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                        {Math.round(el.x)}, {Math.round(el.y)} · {Math.round(el.w)}×{Math.round(el.h)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── コントロールパネル ── */}
          <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 選択中の要素 */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDD9C8', padding: 14 }}>
              {selectedEl ? (
                <>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#F26722', marginBottom: 12, margin: '0 0 12px' }}>{selectedEl.label}</p>

                  {/* 表示/非表示 */}
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, color: '#1C0F05', fontWeight: 600 }}>表示する</span>
                    <input type="checkbox" checked={selectedEl.visible}
                      onChange={e => updateEl(selectedEl.id, { visible: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: '#F26722' }} />
                  </label>

                  {/* フォントサイズ */}
                  {selectedEl.fontSize !== undefined && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: '#1C0F05', fontWeight: 600 }}>フォントサイズ</span>
                        <span style={{ fontSize: 12, color: '#F26722', fontWeight: 800 }}>{selectedEl.fontSize}px</span>
                      </div>
                      <input type="range" min={10} max={36} step={1}
                        value={selectedEl.fontSize}
                        onChange={e => updateEl(selectedEl.id, { fontSize: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#F26722' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#A08068', marginTop: 2 }}>
                        <span>小(10)</span><span>大(36)</span>
                      </div>
                    </div>
                  )}

                  {/* 座標・サイズ */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#FAF5F0', borderRadius: 8, padding: 8 }}>
                    {[['X', Math.round(selectedEl.x)], ['Y', Math.round(selectedEl.y)], ['幅', Math.round(selectedEl.w)], ['高さ', Math.round(selectedEl.h)]].map(([label, val]) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#A08068', fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: 14, color: '#1C0F05', fontWeight: 800 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 12, color: '#A08068', textAlign: 'center', margin: 0 }}>要素をタップして選択</p>
              )}
            </div>

            {/* 要素一覧 */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDD9C8', padding: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#1C0F05', marginBottom: 10, margin: '0 0 10px' }}>要素の表示/非表示</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {elements.map(el => (
                  <div
                    key={el.id}
                    onClick={() => setSelectedId(el.id === selectedId ? null : el.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                      background: selectedId === el.id ? 'rgba(242,103,34,0.08)' : 'transparent',
                      border: `1.5px solid ${selectedId === el.id ? 'rgba(242,103,34,0.25)' : 'transparent'}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: el.visible ? '#1C0F05' : '#C4B5AD', fontWeight: 500 }}>{el.label}</span>
                    <input type="checkbox" checked={el.visible}
                      onChange={e => { e.stopPropagation(); updateEl(el.id, { visible: e.target.checked }) }}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: '#F26722' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* 背景カラー */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDD9C8', padding: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#1C0F05', marginBottom: 10, margin: '0 0 10px' }}>背景カラー</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {BG_PRESETS.map(({ label, color }) => (
                  <button key={color} onClick={() => setBgColor(color)} title={label}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', background: color,
                      border: bgColor === color ? '3px solid #F26722' : '2px solid #EDD9C8',
                      cursor: 'pointer', padding: 0,
                    }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#A08068' }}>カスタム</span>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  style={{ width: 30, height: 30, border: '1px solid #EDD9C8', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <code style={{ fontSize: 10, color: '#A08068' }}>{bgColor}</code>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
