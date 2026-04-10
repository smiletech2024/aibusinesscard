'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard } from '@/types'
import QRCode from 'qrcode'
import { LogoIcon } from '@/components/Logo'

type Design = 'executive' | 'midnight' | 'vivid'

const designMeta: Record<Design, { label: string; desc: string; preview: string }> = {
  executive: { label: 'エグゼクティブ', desc: '上質な白 × インディゴ', preview: '#FFFFFF' },
  midnight:  { label: 'ミッドナイト',   desc: '漆黒 × バイオレット',   preview: '#0D0C2A' },
  vivid:     { label: 'ビビッド',       desc: 'フルグラデーション',     preview: '#6366F1' },
}

/* ─── SVGアイコン ─── */
const IconMail = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)
const IconPhone = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/>
  </svg>
)
const IconGlobe = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

/* ─── QRコード SVG レンダラー (全デバイス対応) ─── */
// canvas は iOS Safari で描画失敗するケースがあるため、
// SVG 文字列をインライン展開する方式を採用。
// html-to-image はインライン SVG を確実にキャプチャできる。
function QRCodeSVG({ url, size, style }: { url: string; size: number; style?: React.CSSProperties }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    if (!url) return
    QRCode.toString(url, {
      type: 'svg',
      width: size,
      margin: 1,
      color: { dark: '#1E1B4B', light: '#FFFFFF' },
    }).then(svgStr => {
      // SVG固有のwidth/heightをコンテナに合わせる
      setSvg(svgStr.replace(/(<svg[^>]*)\swidth="[^"]*"\sheight="[^"]*"/, '$1 width="100%" height="100%"'))
    }).catch(() => {})
  }, [url, size])
  return (
    <div
      style={{ width: size, height: size, display: 'block', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/* ─── カードサイズ ─── */
// 画面プレビュー: 560×338px  /  印刷: 91×55mm
const W = 560
const H = 338

/* ─── ブランドマーク（表面用・極小）※ position は呼び出し元で指定 ─── */
function FrontBrandMark({ theme }: { theme: 'light' | 'dark' }) {
  const color = theme === 'light' ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.35)'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <LogoIcon size={13} />
      <span style={{ fontSize: 7, fontWeight: 700, color, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>AI名刺</span>
    </div>
  )
}

/* ─── ブランドロゴ（裏面用・やや大きめ） ─── */
function BackBrandLogo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <LogoIcon size={20} />
      <div>
        <div style={{ fontSize: 10, fontWeight: 900, color: 'white', letterSpacing: '-0.01em', lineHeight: 1 }}>AI名刺</div>
        <div style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.08em', marginTop: 1 }}>次世代名刺</div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   EXECUTIVE — 白 × インディゴ
══════════════════════════════════════════ */
function ExecutiveFront({ card, qrUrl }: { card: BusinessCard; qrUrl: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#FFFFFF', position: 'relative', overflow: 'hidden', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: 'linear-gradient(180deg, #4338CA 0%, #6366F1 100%)' }} />

      {/* Top-right corner decoration */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: '#EEF2FF', opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: '#C7D2FE', opacity: 0.4 }} />

      {/* Main content */}
      <div style={{ position: 'absolute', left: 32, top: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>

        {/* Company */}
        {card.company && (
          <p style={{ fontSize: 9, color: '#6366F1', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            {card.company}
          </p>
        )}

        {/* Name */}
        <h2 style={{ fontSize: 26, fontWeight: 900, color: '#1E1B4B', margin: '0 0 4px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {card.full_name}
        </h2>

        {/* Title */}
        {card.title && (
          <p style={{ fontSize: 11, color: '#6366F1', fontWeight: 600, margin: '0 0 20px', letterSpacing: '0.02em' }}>
            {card.title}
          </p>
        )}

        {/* Divider */}
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)', borderRadius: 2, marginBottom: 18 }} />

        {/* Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {card.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A4870', fontSize: 10 }}>
              <span style={{ color: '#6366F1' }}><IconMail /></span>
              {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A4870', fontSize: 10 }}>
              <span style={{ color: '#6366F1' }}><IconPhone /></span>
              {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A4870', fontSize: 10 }}>
              <span style={{ color: '#6366F1' }}><IconGlobe /></span>
              {card.website.replace(/https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* QR + ブランド — bottom right */}
      {qrUrl && (
        <div style={{ position: 'absolute', right: 20, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} />
            <span style={{ fontSize: 7, fontWeight: 800, color: '#6366F1', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <QRCodeSVG url={qrUrl} size={76} style={{ border: '1.5px solid #E0E7FF', borderRadius: 8 }} />
          <p style={{ fontSize: 7, color: '#A5B4FC', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}

      {/* Bottom border */}
      <div style={{ position: 'absolute', bottom: 0, left: 8, right: 0, height: 3, background: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, transparent 100%)' }} />
    </div>
  )
}

function ExecutiveBack({ card }: { card: BusinessCard }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#1E1B4B', position: 'relative', overflow: 'hidden', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Grid lines decoration */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: i * 70, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.03)' }} />
      ))}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: i * 70, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.03)' }} />
      ))}

      {/* Left accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, #6366F1, #8B5CF6)' }} />

      {/* Circle decoration */}
      <div style={{ position: 'absolute', right: -60, top: -60, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(99,102,241,0.2)' }} />
      <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(99,102,241,0.15)' }} />

      {/* Content */}
      <div style={{ position: 'absolute', left: 40, top: 0, right: 40, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontSize: 9, color: '#818CF8', fontWeight: 700, letterSpacing: '0.15em', margin: '0 0 14px' }}>
          分身AI搭載名刺
        </p>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: '0 0 12px', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          QRから分身AIに<br />いつでも相談を
        </h3>
        {card.short_intro && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: '0 0 20px', lineHeight: 1.6, maxWidth: 280 }}>
            {card.short_intro}
          </p>
        )}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.2)', borderRadius: 20, padding: '6px 14px', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
          <span style={{ fontSize: 9, color: '#A5B4FC', fontWeight: 700 }}>24時間 オンライン対応中</span>
        </div>
      </div>

      {/* Brand logo */}
      <div style={{ position: 'absolute', bottom: 14, right: 20 }}>
        <BackBrandLogo />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   MIDNIGHT — 漆黒 × バイオレットゴールド
══════════════════════════════════════════ */
function MidnightFront({ card, qrUrl }: { card: BusinessCard; qrUrl: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#0D0C2A', position: 'relative', overflow: 'hidden', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Radial glow */}
      <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />

      {/* Noise texture lines */}
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 28 + 4, height: 1, background: 'rgba(255,255,255,0.015)' }} />
      ))}

      {/* Top gold line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, #C4B5FD 30%, #8B5CF6 70%, transparent 100%)' }} />

      {/* Initial — large decorative */}
      <div style={{ position: 'absolute', right: 140, top: '50%', transform: 'translateY(-50%)', fontSize: 120, fontWeight: 900, color: 'rgba(99,102,241,0.06)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>
        {card.full_name[0]}
      </div>

      {/* Left content */}
      <div style={{ position: 'absolute', left: 32, top: 36, bottom: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && (
            <p style={{ fontSize: 8, color: '#818CF8', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              {card.company}
            </p>
          )}
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {card.full_name}
          </h2>
          {card.title && (
            <p style={{ fontSize: 11, background: 'linear-gradient(90deg, #C4B5FD, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 600, margin: 0 }}>
              {card.title}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 9.5 }}>
              <span style={{ color: '#818CF8' }}><IconMail /></span> {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 9.5 }}>
              <span style={{ color: '#818CF8' }}><IconPhone /></span> {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 9.5 }}>
              <span style={{ color: '#818CF8' }}><IconGlobe /></span> {card.website.replace(/https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* QR + ブランド — right */}
      {qrUrl && (
        <div style={{ position: 'absolute', right: 22, bottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} />
            <span style={{ fontSize: 7, fontWeight: 800, color: '#A78BFA', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
            <QRCodeSVG url={qrUrl} size={68} style={{ borderRadius: 4 }} />
          </div>
          <p style={{ fontSize: 7, color: '#818CF8', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}

      {/* Bottom line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, #C4B5FD 30%, #8B5CF6 70%, transparent 100%)' }} />
    </div>
  )
}

function MidnightBack({ card }: { card: BusinessCard }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #0D0C2A 0%, #150E3A 50%, #0D0C2A 100%)', position: 'relative', overflow: 'hidden', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />

      {/* Top/Bottom lines */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,181,253,0.4), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,181,253,0.4), transparent)' }} />

      {/* Center content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        {/* Logo icon */}
        <div style={{ marginBottom: 14 }}>
          <LogoIcon size={40} />
        </div>

        <p style={{ fontSize: 8, color: '#818CF8', fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
          QRをスキャンして<br />分身AIと話してください
        </h3>
        {card.short_intro && (
          <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 320 }}>
            {card.short_intro}
          </p>
        )}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #818CF8, transparent)', marginBottom: 16 }} />
        <div style={{ marginTop: 16 }}>
          <BackBrandLogo />
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   VIVID — フルグラデーション
══════════════════════════════════════════ */
function VividFront({ card, qrUrl }: { card: BusinessCard; qrUrl: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 40%, #7C3AED 70%, #9333EA 100%)', position: 'relative', overflow: 'hidden', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Geometric decorations */}
      <div style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      {/* Large watermark initial */}
      <div style={{ position: 'absolute', right: 130, top: '50%', transform: 'translateY(-50%)', fontSize: 130, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>
        {card.full_name[0]}
      </div>

      {/* Left content */}
      <div style={{ position: 'absolute', left: 32, top: 32, bottom: 44, right: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && (
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              {card.company}
            </p>
          )}
          <h2 style={{ fontSize: 30, fontWeight: 900, color: 'white', margin: '0 0 6px', lineHeight: 1.0, letterSpacing: '-0.03em', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            {card.full_name}
          </h2>
          {card.title && (
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: 4, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.95)', fontWeight: 600, margin: 0 }}>
                {card.title}
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: 9.5 }}>
              <IconMail /> {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: 9.5 }}>
              <IconPhone /> {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: 9.5 }}>
              <IconGlobe /> {card.website.replace(/https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* QR + ブランド */}
      {qrUrl && (
        <div style={{ position: 'absolute', right: 20, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} />
            <span style={{ fontSize: 7, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
            <QRCodeSVG url={qrUrl} size={70} style={{ borderRadius: 5 }} />
          </div>
          <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}

      {/* Bottom left: online badge のみ */}
      <div style={{ position: 'absolute', bottom: 14, left: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', fontWeight: 600, whiteSpace: 'nowrap' }}>分身AI オンライン</span>
      </div>
    </div>
  )
}

function VividBack({ card }: { card: BusinessCard }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(225deg, #4338CA 0%, #6366F1 30%, #8B5CF6 70%, #A855F7 100%)', position: 'relative', overflow: 'hidden', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* White shape */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '45%', bottom: 0, background: 'rgba(255,255,255,0.07)', clipPath: 'polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)' }} />

      {/* Circles */}
      <div style={{ position: 'absolute', left: -40, top: -40, width: 160, height: 160, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'absolute', left: -10, top: -10, width: 80, height: 80, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)' }} />

      {/* Content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 40px', textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <LogoIcon size={44} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <BackBrandLogo />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.2, textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
          このQRから<br />分身AIに相談できます
        </h3>
        {card.short_intro && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 300 }}>
            {card.short_intro}
          </p>
        )}
        <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: '7px 20px', border: '1px solid rgba(255,255,255,0.25)' }}>
          <p style={{ color: 'white', fontSize: 9, margin: 0, fontWeight: 700 }}>
            QRスキャン → AI対話 → 本人に接続
          </p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   カードプレビュー（レスポンシブ対応）
══════════════════════════════════════════ */
function CardPreview({
  label, children, onDownload, disabled, btnLabel, captureRef
}: {
  label: string
  children: React.ReactNode
  onDownload: () => void
  disabled: boolean
  btnLabel: string
  captureRef: React.RefObject<HTMLDivElement | null>
}) {
  const [scale, setScale] = React.useState(0.85)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const update = () => {
      if (wrapperRef.current) {
        const available = wrapperRef.current.parentElement?.clientWidth ?? window.innerWidth
        setScale(Math.min(1, (available - 32) / W))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#9896B8', textTransform: 'uppercase' as const }}>{label}</p>
      {/* スケール外枠（影・角丸） */}
      <div style={{
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(99,102,241,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        width: W * scale,
        height: H * scale,
        flexShrink: 0,
      }}>
        {/* スケール内：フルサイズでレンダリング → transform で縮小 */}
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: W, height: H }}>
          {/* ← ここに ref を付ける：スケール前のフルサイズDOM */}
          <div ref={captureRef} style={{ width: W, height: H }}>
            {children}
          </div>
        </div>
      </div>
      <button onClick={onDownload} disabled={disabled} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px',
        borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: 'white', color: '#4A4870',
        border: '1.5px solid #E8E6F5', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {btnLabel}
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════
   メインページ
══════════════════════════════════════════ */
export default function PrintCardPage() {
  const params = useParams()
  const cardId = params.cardId as string
  const [card, setCard] = useState<BusinessCard | null>(null)
  const [cardQrUrl, setCardQrUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [design, setDesign] = useState<Design>('executive')
  const [dlState, setDlState] = useState<'idle' | 'front' | 'back' | 'both' | 'qr'>('idle')
  const frontRef  = useRef<HTMLDivElement>(null)
  const backRef   = useRef<HTMLDivElement>(null)
  const qrBlockRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => { loadCard() }, [cardId])

  // 印刷会社向け高解像度PNG (350dpi 相当 / pixelRatio=3)
  const downloadPng = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return
    const dataUrl = await toPng(ref.current, {
      pixelRatio: 3,
    })
    const a = document.createElement('a')
    a.download = filename
    a.href = dataUrl
    a.click()
  }, [])

  const handleDownload = useCallback(async (side: 'front' | 'back' | 'both' | 'qr') => {
    if (!card) return
    const base = card.full_name.replace(/\s/g, '_')
    setDlState(side)
    try {
      if (side === 'front' || side === 'both') {
        await downloadPng(frontRef, `${base}_表面_${designMeta[design].label}.png`)
      }
      if (side === 'back' || side === 'both') {
        await downloadPng(backRef, `${base}_裏面_${designMeta[design].label}.png`)
      }
      if (side === 'qr') {
        await downloadPng(qrBlockRef, `${base}_QRコード素材.png`)
      }
    } finally {
      setDlState('idle')
    }
  }, [card, design, downloadPng])

  const loadCard = async () => {
    const { data } = await supabase.from('business_cards').select('*').eq('id', cardId).single()
    if (data) {
      setCard(data)
      setCardQrUrl(`${window.location.origin}/card/${cardId}`)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F3FA" }}>
        <div className="w-10 h-10 border-3 rounded-full spin"
          style={{ border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }
  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F3FA" }}>
        <p style={{ color: "#9896B8" }}>名刺が見つかりません</p>
      </div>
    )
  }

  const FrontComponent = design === 'executive' ? ExecutiveFront : design === 'midnight' ? MidnightFront : VividFront
  const BackComponent  = design === 'executive' ? ExecutiveBack  : design === 'midnight' ? MidnightBack  : VividBack

  return (
    <div className="min-h-screen" style={{ background: "#F4F3FA" }}>
      {/* ─── コントロールパネル ─── */}
      <div className="no-print border-b sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderColor: '#E8E6F5' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 行1: 戻るボタン + タイトル + 印刷ボタン */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/dashboard" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20,
              color: '#4A4870', border: '1.5px solid #E8E6F5', background: 'white',
              textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              戻る
            </a>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#1E1B4B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>名刺デザイン印刷</p>
              <p style={{ fontSize: 11, color: '#9896B8', margin: 0 }}>91×55mm · 表面・裏面</p>
            </div>
            <button onClick={() => window.print()} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white',
              border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              印刷
            </button>
          </div>

          {/* 行2: デザイン選択 + ダウンロードボタン */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* デザイン選択 */}
            <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, overflowX: 'auto' }}>
              {(Object.entries(designMeta) as [Design, typeof designMeta[Design]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setDesign(key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: design === key ? '#6366F1' : 'white',
                  color: design === key ? 'white' : '#4A4870',
                  border: `1.5px solid ${design === key ? 'transparent' : '#E8E6F5'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  boxShadow: design === key ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.preview, border: '1.5px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                  {meta.label}
                </button>
              ))}
            </div>

            {/* ダウンロードボタン */}
            <button
              onClick={() => handleDownload('both')}
              disabled={dlState !== 'idle'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: dlState !== 'idle' ? '#E8E6F5' : '#0F0E1E',
                color: dlState !== 'idle' ? '#9896B8' : '#F0C040',
                border: 'none', cursor: dlState !== 'idle' ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: dlState !== 'idle' ? 'none' : '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              {dlState !== 'idle' ? (
                <>
                  <span style={{ width: 10, height: 10, border: '2px solid #9896B8', borderTopColor: '#6366F1', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  作成中...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  印刷データ保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── プレビューエリア ─── */}
      <div className="no-print" style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        {/* デザイン説明 */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#9896B8', marginBottom: 4 }}>{designMeta[design].label}</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#4A4870' }}>{designMeta[design].desc}</p>
        </div>

        {/* 表面 */}
        <CardPreview
          label="表面"
          onDownload={() => handleDownload('front')}
          disabled={dlState !== 'idle'}
          btnLabel="表面を保存"
          captureRef={frontRef}
        >
          <FrontComponent card={card} qrUrl={cardQrUrl} />
        </CardPreview>

        {/* 裏面 */}
        <CardPreview
          label="裏面"
          onDownload={() => handleDownload('back')}
          disabled={dlState !== 'idle'}
          btnLabel="裏面を保存"
          captureRef={backRef}
        >
          <BackComponent card={card} />
        </CardPreview>

        {/* ── QRコード素材ダウンロード ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 520 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#9896B8', textTransform: 'uppercase' as const, marginBottom: 4 }}>QRコード素材</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B', marginBottom: 2 }}>自分でデザインする名刺に使えるQR素材</p>
            <p style={{ fontSize: 11, color: '#9896B8' }}>お好みのデザインツールでご自由に配置できます</p>
          </div>

          {/* QRブロックプレビュー */}
          <div style={{ background: '#F4F3FA', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* キャプチャ対象 */}
            <div ref={qrBlockRef} style={{
              background: 'white',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 16px rgba(99,102,241,0.1)',
              border: '1px solid #E8E6F5',
              width: 140,
            }}>
              {/* ロゴ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <LogoIcon size={16} />
                <span style={{ fontSize: 9, fontWeight: 900, color: '#1E1B4B', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>AI名刺</span>
              </div>
              {/* QRコード */}
              {cardQrUrl && (
                <QRCodeSVG url={cardQrUrl} size={100} style={{ borderRadius: 8 }} />
              )}
              {/* テキスト */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 7.5, fontWeight: 700, color: '#6366F1', margin: '0 0 2px', whiteSpace: 'nowrap' }}>QRをスキャン</p>
                <p style={{ fontSize: 7, color: '#9896B8', margin: 0, whiteSpace: 'nowrap' }}>分身AIに直接相談できます</p>
              </div>
            </div>
            <p style={{ fontSize: 10, color: '#9896B8' }}>← このサイズで出力されます（3倍解像度）</p>
          </div>

          <button
            onClick={() => handleDownload('qr')}
            disabled={dlState !== 'idle' || !cardQrUrl}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: dlState === 'qr' ? '#E8E6F5' : 'linear-gradient(135deg, #1E1B4B, #4338CA)',
              color: dlState === 'qr' ? '#9896B8' : 'white',
              border: 'none', cursor: dlState !== 'idle' ? 'not-allowed' : 'pointer',
              boxShadow: dlState === 'qr' ? 'none' : '0 4px 16px rgba(30,27,75,0.3)',
            }}
          >
            {dlState === 'qr' ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid #9896B8', borderTopColor: '#6366F1', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                作成中...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                QRコード素材をダウンロード
              </>
            )}
          </button>

          {/* 使い方ガイド */}
          <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '12px 16px', width: '100%' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', marginBottom: 6 }}>💡 使い方</p>
            <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['QRコード素材をダウンロード（PNG・高解像度）',
                'Canva / Illustrator / Figma などに素材として読み込む',
                'お好みの名刺デザインに配置・調整',
                '印刷会社や自宅プリンターで印刷'].map(s => (
                <li key={s} style={{ fontSize: 11, color: '#4A4870', lineHeight: 1.6 }}>{s}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* 印刷会社向け情報 */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8E6F5', padding: 20, maxWidth: 520, width: '100%', boxShadow: '0 1px 4px rgba(99,102,241,0.06)' }}>
          <p style={{ fontSize: 13, fontWeight: 900, color: '#1E1B4B', marginBottom: 14 }}>印刷会社への入稿について</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '📐', text: '仕上がりサイズ: 91×55mm（標準名刺サイズ）' },
              { icon: '🖨️', text: '解像度: 350dpi 相当（印刷品質）で保存されます' },
              { icon: '🎨', text: 'カラーモード: RGB（印刷会社でCMYKに変換を依頼）' },
              { icon: '✂️', text: '塗り足し: 必要な場合は印刷会社に3mm塗り足し追加を依頼' },
              { icon: '📄', text: 'ファイル形式: PNG（入稿可能かを事前に印刷会社へ確認）' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
                <span style={{ fontSize: 12, color: '#4A4870', lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#F4F3FA', borderRadius: 10 }}>
            <p style={{ fontSize: 11, color: '#9896B8', lineHeight: 1.6, margin: 0 }}>
              💡 「印刷データ保存」ボタンで表面・裏面を一括ダウンロード。各カードの下の「表面を保存」「裏面を保存」で個別にもダウンロードできます。
            </p>
          </div>
        </div>
      </div>

      {/* ─── 印刷用（実寸） ─── */}
      <div className="print-only" style={{ display: 'none' }}>
        <div className="print-card">
          <FrontComponent card={card} qrUrl={cardQrUrl} />
        </div>
        <div className="print-card">
          <BackComponent card={card} />
        </div>
      </div>

      {/* ─── 印刷CSS ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 91mm 55mm; margin: 0; }
          body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-card {
            width: 91mm !important;
            height: 55mm !important;
            page-break-after: always;
            overflow: hidden;
          }
          .print-card > div {
            transform: none !important;
            width: 91mm !important;
            height: 55mm !important;
          }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      ` }} />
    </div>
  )
}
