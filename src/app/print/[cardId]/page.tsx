'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BusinessCard } from '@/types'
import QRCode from 'qrcode'
import { LogoIcon } from '@/components/Logo'
import jsPDF from 'jspdf'

type Design = 'executive' | 'midnight' | 'vivid'
type Font   = 'sans' | 'serif' | 'rounded'

const designMeta: Record<Design, { label: string; desc: string; preview: string }> = {
  executive: { label: 'エグゼクティブ', desc: '上質な白 × インディゴ', preview: '#FFFFFF' },
  midnight:  { label: 'ミッドナイト',   desc: '漆黒 × バイオレット',   preview: '#0D0C2A' },
  vivid:     { label: 'ビビッド',       desc: 'フルグラデーション',     preview: '#F26722' },
}

const fontMeta: Record<Font, { label: string; desc: string; family: string }> = {
  sans:    { label: 'ゴシック',  desc: '現代的・読みやすい',  family: "'Helvetica Neue', 'Hiragino Sans', 'Yu Gothic', Arial, sans-serif" },
  serif:   { label: '明朝体',    desc: '格調・クラシック',    family: "'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif" },
  rounded: { label: '丸ゴシック', desc: '親しみやすい・柔らか', family: "'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Rounded Mplus 1c', system-ui, sans-serif" },
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
      color: { dark: '#1C0F05', light: '#FFFFFF' },
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
  const color = theme === 'light' ? 'rgba(242,103,34,0.45)' : 'rgba(255,255,255,0.35)'
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
function ExecutiveFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 18 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#FFFFFF', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: 'linear-gradient(180deg, #C4511A 0%, #F26722 100%)' }} />

      {/* Top-right corner decoration */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: '#FFF0E8', opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: '#FDD5B5', opacity: 0.4 }} />

      {/* User logo */}
      {logoUrl && (
        <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 28, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', pointerEvents: 'none' }} />
      )}

      {/* Main content */}
      <div style={{ position: 'absolute', left: 32, top: 0, right: 112, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>

        {/* Company */}
        {card.company && (
          <p style={{ fontSize: 9, color: '#F26722', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            {card.company}
          </p>
        )}

        {/* Name */}
        <h2 style={{ fontSize: 26, fontWeight: 900, color: '#1C0F05', margin: '0 0 4px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {card.full_name}
        </h2>

        {/* Title */}
        {card.title && (
          <p style={{ fontSize: 11, color: '#F26722', fontWeight: 600, margin: '0 0 20px', letterSpacing: '0.02em' }}>
            {card.title}
          </p>
        )}

        {/* Divider */}
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #F26722, #F59340)', borderRadius: 2, marginBottom: 18 }} />

        {/* Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {card.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A2C1A', fontSize: 10 }}>
              <span style={{ color: '#F26722' }}><IconMail /></span>
              {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A2C1A', fontSize: 10 }}>
              <span style={{ color: '#F26722' }}><IconPhone /></span>
              {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A2C1A', fontSize: 10 }}>
              <span style={{ color: '#F26722' }}><IconGlobe /></span>
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
            <span style={{ fontSize: 7, fontWeight: 800, color: '#F26722', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <QRCodeSVG url={qrUrl} size={76} style={{ border: '1.5px solid #E0E7FF', borderRadius: 8 }} />
          <p style={{ fontSize: 7, color: '#A5B4FC', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}

      {/* Bottom border */}
      <div style={{ position: 'absolute', bottom: 0, left: 8, right: 0, height: 3, background: 'linear-gradient(90deg, #F26722 0%, #F59340 50%, transparent 100%)' }} />
    </div>
  )
}

function ExecutiveBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#1C0F05', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Grid lines decoration */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: i * 70, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.03)' }} />
      ))}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: i * 70, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.03)' }} />
      ))}

      {/* Left accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, #F26722, #F59340)' }} />

      {/* Circle decoration */}
      <div style={{ position: 'absolute', right: -60, top: -60, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(242,103,34,0.2)' }} />
      <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(242,103,34,0.15)' }} />

      {/* Content */}
      <div style={{ position: 'absolute', left: 40, top: 0, right: 40, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontSize: 9, color: '#F5A47A', fontWeight: 700, letterSpacing: '0.15em', margin: '0 0 14px' }}>
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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(242,103,34,0.2)', borderRadius: 20, padding: '6px 14px', border: '1px solid rgba(242,103,34,0.3)' }}>
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
function MidnightFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#0D0C2A', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Radial glow */}
      <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,103,34,0.18) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,103,34,0.12) 0%, transparent 70%)' }} />

      {/* Noise texture lines */}
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 28 + 4, height: 1, background: 'rgba(255,255,255,0.015)' }} />
      ))}

      {/* Top gold line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, #FDD5B5 30%, #F59340 70%, transparent 100%)' }} />

      {/* User logo */}
      {logoUrl && (
        <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', opacity: 0.85, pointerEvents: 'none' }} />
      )}

      {/* Initial — large decorative */}
      <div style={{ position: 'absolute', right: 140, top: '50%', transform: 'translateY(-50%)', fontSize: 120, fontWeight: 900, color: 'rgba(242,103,34,0.06)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>
        {card.full_name[0]}
      </div>

      {/* Left content */}
      <div style={{ position: 'absolute', left: 32, top: 36, bottom: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && (
            <p style={{ fontSize: 8, color: '#F5A47A', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              {card.company}
            </p>
          )}
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {card.full_name}
          </h2>
          {card.title && (
            <p style={{ fontSize: 11, background: 'linear-gradient(90deg, #FDD5B5, #F5C09A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 600, margin: 0 }}>
              {card.title}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 9.5 }}>
              <span style={{ color: '#F5A47A' }}><IconMail /></span> {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 9.5 }}>
              <span style={{ color: '#F5A47A' }}><IconPhone /></span> {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 9.5 }}>
              <span style={{ color: '#F5A47A' }}><IconGlobe /></span> {card.website.replace(/https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* QR + ブランド — right */}
      {qrUrl && (
        <div style={{ position: 'absolute', right: 22, bottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} />
            <span style={{ fontSize: 7, fontWeight: 800, color: '#F5C09A', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 0 20px rgba(242,103,34,0.3)' }}>
            <QRCodeSVG url={qrUrl} size={68} style={{ borderRadius: 4 }} />
          </div>
          <p style={{ fontSize: 7, color: '#F5A47A', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}

      {/* Bottom line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, #FDD5B5 30%, #F59340 70%, transparent 100%)' }} />
    </div>
  )
}

function MidnightBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #0D0C2A 0%, #150E3A 50%, #0D0C2A 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(242,103,34,0.15) 0%, transparent 70%)' }} />

      {/* Top/Bottom lines */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,181,253,0.4), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,181,253,0.4), transparent)' }} />

      {/* Center content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        {/* Logo icon */}
        <div style={{ marginBottom: 14 }}>
          <LogoIcon size={40} />
        </div>

        <p style={{ fontSize: 8, color: '#F5A47A', fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
          QRをスキャンして<br />分身AIと話してください
        </h3>
        {card.short_intro && (
          <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 320 }}>
            {card.short_intro}
          </p>
        )}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #F5A47A, transparent)', marginBottom: 16 }} />
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
function VividFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #C4511A 0%, #F26722 40%, #D4691E 70%, #F59340 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Geometric decorations */}
      <div style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      {/* Large watermark initial */}
      <div style={{ position: 'absolute', right: 130, top: '50%', transform: 'translateY(-50%)', fontSize: 130, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>
        {card.full_name[0]}
      </div>

      {/* User logo */}
      {logoUrl && (
        <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', opacity: 0.85, pointerEvents: 'none' }} />
      )}

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

function VividBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(225deg, #C4511A 0%, #F26722 30%, #F59340 70%, #F59340 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
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
  label, children, onDownload, disabled, btnLabel, captureRef,
  overlay,
}: {
  label: string
  children: React.ReactNode
  onDownload: () => void
  disabled: boolean
  btnLabel: string
  captureRef: React.RefObject<HTMLDivElement | null>
  /** captureRef の外・scale内に描画するオーバーレイ（ドラッグハンドル等）*/
  overlay?: (scale: number) => React.ReactNode
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
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#A08068', textTransform: 'uppercase' as const }}>{label}</p>
      {/* スケール外枠（影・角丸） */}
      <div style={{
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(242,103,34,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        width: W * scale,
        height: H * scale,
        flexShrink: 0,
      }}>
        {/* スケール内：フルサイズでレンダリング → transform で縮小 */}
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: W, height: H, position: 'relative' }}>
          {/* ← ここに ref を付ける：スケール前のフルサイズDOM */}
          <div ref={captureRef} style={{ width: W, height: H }}>
            {children}
          </div>
          {/* captureRef の外に描画するオーバーレイ（キャプチャ対象外） */}
          {overlay?.(scale)}
        </div>
      </div>
      <button onClick={onDownload} disabled={disabled} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px',
        borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: 'white', color: '#4A2C1A',
        border: '1.5px solid #EDD9C8', cursor: disabled ? 'not-allowed' : 'pointer',
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
  const [font, setFont] = useState<Font>('sans')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoX, setLogoX] = useState(32)
  const [logoY, setLogoY] = useState(16)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBanner, setSavedBanner] = useState(false)
  const [dlState, setDlState] = useState<'idle' | 'front' | 'back' | 'both' | 'qr' | 'pdf'>('idle')
  const frontRef  = useRef<HTMLDivElement>(null)
  const backRef   = useRef<HTMLDivElement>(null)
  const qrBlockRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => { loadCard() }, [cardId])

  // 印刷会社向け高解像度PNG (350dpi 相当 / pixelRatio=3)
  const downloadPng = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return
    const dataUrl = await toPng(ref.current, { pixelRatio: 3 })
    const a = document.createElement('a')
    a.download = filename
    a.href = dataUrl
    a.click()
  }, [])

  // 印刷会社入稿用PDF（表面+裏面を1ファイルに）
  const handleDownloadPdf = useCallback(async () => {
    if (!card || !frontRef.current || !backRef.current) return
    setDlState('pdf')
    try {
      // 91×55mm を px 換算（pixelRatio=3 → 350dpi 相当）
      const [frontDataUrl, backDataUrl] = await Promise.all([
        toPng(frontRef.current, { pixelRatio: 3 }),
        toPng(backRef.current, { pixelRatio: 3 }),
      ])

      // jsPDF: 横向き 91×55mm
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [91, 55],
      })

      // 表面（1ページ目）
      pdf.addImage(frontDataUrl, 'PNG', 0, 0, 91, 55, undefined, 'FAST')

      // 裏面（2ページ目）
      pdf.addPage([91, 55], 'landscape')
      pdf.addImage(backDataUrl, 'PNG', 0, 0, 91, 55, undefined, 'FAST')

      const base = card.full_name.replace(/\s/g, '_')
      pdf.save(`${base}_名刺入稿用_${designMeta[design].label}.pdf`)
    } finally {
      setDlState('idle')
    }
  }, [card, design])

  // 印刷: カードを PNG キャプチャ → 印刷専用ウィンドウで確実に印刷
  const handlePrint = useCallback(async () => {
    if (!frontRef.current || !backRef.current) return
    setDlState('pdf') // スピナー流用
    try {
      const [frontUrl, backUrl] = await Promise.all([
        toPng(frontRef.current, { pixelRatio: 3 }),
        toPng(backRef.current,  { pixelRatio: 3 }),
      ])
      const win = window.open('', '_blank')
      if (!win) { alert('ポップアップをブロックされています。ブラウザのポップアップ許可を設定してください。'); return }
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          @page { size: 91mm 55mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: white; }
          img { width: 91mm; height: 55mm; display: block; page-break-after: always; break-after: page; }
        </style>
      </head><body>
        <img src="${frontUrl}" />
        <img src="${backUrl}" />
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body></html>`)
      win.document.close()
    } finally {
      setDlState('idle')
    }
  }, [frontRef, backRef])

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
      // 保存済みスタイル設定を復元
      if (data.image_url) {
        try {
          const cfg = JSON.parse(data.image_url)
          if (cfg.theme && cfg.theme in designMeta) setDesign(cfg.theme as Design)
          if (cfg.font  && cfg.font  in fontMeta)   setFont(cfg.font  as Font)
          if (cfg.logoUrl) setLogoUrl(cfg.logoUrl)
          if (typeof cfg.logoX === 'number') setLogoX(cfg.logoX)
          if (typeof cfg.logoY === 'number') setLogoY(cfg.logoY)
        } catch {
          // image_url が JSON でない場合は無視（旧データ互換）
        }
      }
    }
    setLoading(false)
  }

  // ロゴドラッグ（カードプレビュー上でポインタ操作）
  const handleLogoDragStart = useCallback((e: React.PointerEvent, scale: number) => {
    e.preventDefault()
    e.stopPropagation()
    const startClientX = e.clientX
    const startClientY = e.clientY
    const startX = logoX
    const startY = logoY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const handleMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / scale
      const dy = (ev.clientY - startClientY) / scale
      setLogoX(Math.round(Math.max(0, Math.min(W - 90, startX + dx))))
      setLogoY(Math.round(Math.max(0, Math.min(H - 32, startY + dy))))
    }
    const handleUp = (ev: PointerEvent) => {
      ;(e.target as HTMLElement).releasePointerCapture(ev.pointerId)
      ;(e.target as HTMLElement).removeEventListener('pointermove', handleMove as EventListener)
      ;(e.target as HTMLElement).removeEventListener('pointerup', handleUp as EventListener)
    }
    ;(e.target as HTMLElement).addEventListener('pointermove', handleMove as EventListener)
    ;(e.target as HTMLElement).addEventListener('pointerup', handleUp as EventListener)
  }, [logoX, logoY])

  // ロゴをcanvasでリサイズしてbase64に変換
  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onload = () => {
        const MAX = 200
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        setLogoUrl(canvas.toDataURL('image/png'))
        setLogoUploading(false)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
    // input をリセット（同じファイルを再選択できるように）
    e.target.value = ''
  }, [])

  const handleSaveStyle = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/card/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_config: { theme: design, font, logoUrl: logoUrl || null, logoX, logoY } }),
      })
      if (res.ok) {
        setSavedBanner(true)
        setTimeout(() => setSavedBanner(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF5F0" }}>
        <div className="w-10 h-10 border-3 rounded-full spin"
          style={{ border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }
  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF5F0" }}>
        <p style={{ color: "#A08068" }}>名刺が見つかりません</p>
      </div>
    )
  }

  const FrontComponent = (design === 'executive' ? ExecutiveFront : design === 'midnight' ? MidnightFront : VividFront) as React.ComponentType<{ card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }>
  const BackComponent  = (design === 'executive' ? ExecutiveBack  : design === 'midnight' ? MidnightBack  : VividBack)  as React.ComponentType<{ card: BusinessCard; fontFamily?: string }>

  const currentFontFamily = fontMeta[font].family

  return (
    <div className="min-h-screen" style={{ background: "#FAF5F0" }}>

      {/* ─── 保存完了バナー ─── */}
      {savedBanner && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#1C0F05', color: 'white',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#4ADE80' }}>✓</span> デザインを保存しました
        </div>
      )}

      {/* ─── コントロールパネル ─── */}
      <div className="no-print border-b sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderColor: '#EDD9C8' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 行1: 戻るボタン + タイトル + PDFで保存 + 印刷 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/dashboard" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20,
              color: '#4A2C1A', border: '1.5px solid #EDD9C8', background: 'white',
              textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              戻る
            </a>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#1C0F05', margin: 0 }}>名刺デザイン</p>
              <p style={{ fontSize: 10, color: '#A08068', margin: 0 }}>91×55mm</p>
            </div>
            {/* 入稿用PDFボタン（アイコン＋短テキスト） */}
            <button
              onClick={handleDownloadPdf}
              disabled={dlState !== 'idle'}
              title="入稿用PDFを保存（表面＋裏面）"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, padding: '7px 10px', borderRadius: 10,
                background: dlState === 'pdf' ? '#EDD9C8' : '#1C0F05',
                color: dlState === 'pdf' ? '#A08068' : '#F0C040',
                border: 'none', cursor: dlState !== 'idle' ? 'not-allowed' : 'pointer',
                flexShrink: 0, whiteSpace: 'nowrap',
                boxShadow: dlState === 'pdf' ? 'none' : '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              {dlState === 'pdf' ? (
                <span style={{ width: 10, height: 10, border: '2px solid #A08068', borderTopColor: '#F26722', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              )}
              {dlState === 'pdf' ? '作成中...' : 'PDF保存'}
            </button>
            <button
              onClick={handlePrint}
              disabled={dlState !== 'idle'}
              title="表面・裏面を印刷"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, padding: '7px 10px', borderRadius: 10,
                background: dlState !== 'idle' ? '#EDD9C8' : 'linear-gradient(135deg, #F26722, #F59340)',
                color: dlState !== 'idle' ? '#A08068' : 'white',
                border: 'none', cursor: dlState !== 'idle' ? 'not-allowed' : 'pointer',
                flexShrink: 0, whiteSpace: 'nowrap',
                boxShadow: dlState !== 'idle' ? 'none' : '0 2px 8px rgba(242,103,34,0.3)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              印刷
            </button>
          </div>

          {/* 行2: カラー選択（1行に収まる・スクロール不要） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A08068', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 36 }}>カラー</span>
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {(Object.entries(designMeta) as [Design, typeof designMeta[Design]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setDesign(key)} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: design === key ? '#F26722' : 'white',
                  color: design === key ? 'white' : '#4A2C1A',
                  border: `1.5px solid ${design === key ? 'transparent' : '#EDD9C8'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: design === key ? '0 2px 8px rgba(242,103,34,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.preview, border: '1.5px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* 行3: フォント選択 + 保存ボタン */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A08068', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 36 }}>書体</span>
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {(Object.entries(fontMeta) as [Font, typeof fontMeta[Font]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setFont(key)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: font === key ? '#1C0F05' : 'white',
                  color: font === key ? 'white' : '#4A2C1A',
                  border: `1.5px solid ${font === key ? 'transparent' : '#EDD9C8'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: font === key ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                  fontFamily: meta.family,
                  transition: 'all 0.15s',
                }}>
                  {meta.label}
                </button>
              ))}
            </div>
            {/* 保存ボタン */}
            <button
              onClick={handleSaveStyle}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: saving ? '#EDD9C8' : '#FFF0E8',
                color: saving ? '#A08068' : '#C4511A',
                border: '1.5px solid #FDD5B5',
                cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          {/* 行4: ロゴアップロード */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A08068', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 36 }}>ロゴ</span>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: 'white', color: '#4A2C1A',
              border: '1.5px solid #EDD9C8', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {logoUploading ? '処理中...' : 'ロゴ画像を選択'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} disabled={logoUploading} />
            </label>
            {logoUrl && (
              <>
                <img src={logoUrl} alt="logo preview" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4, border: '1px solid #EDD9C8', background: 'white', padding: 2 }} />
                <button onClick={() => { setLogoUrl(''); setLogoX(32); setLogoY(16) }} style={{
                  width: 22, height: 22, borderRadius: '50%', border: '1px solid #EDD9C8',
                  background: 'white', color: '#A08068', cursor: 'pointer', fontSize: 12,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>×</button>
              </>
            )}
            {!logoUrl && (
              <span style={{ fontSize: 10, color: '#A08068' }}>PNG・JPG・SVG 対応</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── プレビューエリア ─── */}
      <div className="no-print" style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}>
        {/* デザイン説明 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#A08068' }}>{designMeta[design].label}</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#DEC4AD', display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#A08068', fontFamily: currentFontFamily }}>{fontMeta[font].label}</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#4A2C1A', fontFamily: currentFontFamily }}>{designMeta[design].desc} · {fontMeta[font].desc}</p>
        </div>

        {/* 表面 */}
        <CardPreview
          label="表面"
          onDownload={() => handleDownload('front')}
          disabled={dlState !== 'idle'}
          btnLabel="表面を保存"
          captureRef={frontRef}
          overlay={logoUrl ? (scale) => (
            /* ドラッグハンドル — captureRef の外なのでPDFに含まれない */
            <div
              onPointerDown={(e) => handleLogoDragStart(e, scale)}
              style={{
                position: 'absolute',
                left: logoX - 3,
                top: logoY - 3,
                width: 96,
                height: 34,
                cursor: 'move',
                border: '2px dashed rgba(242,103,34,0.7)',
                borderRadius: 6,
                boxSizing: 'border-box',
                zIndex: 20,
                touchAction: 'none',
                userSelect: 'none',
              }}
              title="ドラッグしてロゴを移動"
            >
              {/* 移動アイコン */}
              <div style={{
                position: 'absolute', top: -10, right: -10,
                width: 18, height: 18, borderRadius: '50%',
                background: '#F26722', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                pointerEvents: 'none',
              }}>✥</div>
            </div>
          ) : undefined}
        >
          <FrontComponent card={card} qrUrl={cardQrUrl} fontFamily={currentFontFamily} logoUrl={logoUrl || undefined} logoX={logoX} logoY={logoY} />
        </CardPreview>

        {/* 裏面 */}
        <CardPreview
          label="裏面"
          onDownload={() => handleDownload('back')}
          disabled={dlState !== 'idle'}
          btnLabel="裏面を保存"
          captureRef={backRef}
        >
          <BackComponent card={card} fontFamily={currentFontFamily} />
        </CardPreview>

        {/* ── QRコード素材ダウンロード ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 520 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#A08068', textTransform: 'uppercase' as const, marginBottom: 4 }}>QRコード素材</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1C0F05', marginBottom: 2 }}>自分でデザインする名刺に使えるQR素材</p>
            <p style={{ fontSize: 11, color: '#A08068' }}>お好みのデザインツールでご自由に配置できます</p>
          </div>

          {/* QRブロックプレビュー */}
          <div style={{ background: '#FAF5F0', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* キャプチャ対象 */}
            <div ref={qrBlockRef} style={{
              background: 'white',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 16px rgba(242,103,34,0.1)',
              border: '1px solid #EDD9C8',
              width: 140,
            }}>
              {/* ロゴ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <LogoIcon size={16} />
                <span style={{ fontSize: 9, fontWeight: 900, color: '#1C0F05', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>AI名刺</span>
              </div>
              {/* QRコード */}
              {cardQrUrl && (
                <QRCodeSVG url={cardQrUrl} size={100} style={{ borderRadius: 8 }} />
              )}
              {/* テキスト */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 7.5, fontWeight: 700, color: '#F26722', margin: '0 0 2px', whiteSpace: 'nowrap' }}>QRをスキャン</p>
                <p style={{ fontSize: 7, color: '#A08068', margin: 0, whiteSpace: 'nowrap' }}>分身AIに直接相談できます</p>
              </div>
            </div>
            <p style={{ fontSize: 10, color: '#A08068' }}>← このサイズで出力されます（3倍解像度）</p>
          </div>

          <button
            onClick={() => handleDownload('qr')}
            disabled={dlState !== 'idle' || !cardQrUrl}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: dlState === 'qr' ? '#EDD9C8' : 'linear-gradient(135deg, #1C0F05, #C4511A)',
              color: dlState === 'qr' ? '#A08068' : 'white',
              border: 'none', cursor: dlState !== 'idle' ? 'not-allowed' : 'pointer',
              boxShadow: dlState === 'qr' ? 'none' : '0 4px 16px rgba(30,27,75,0.3)',
            }}
          >
            {dlState === 'qr' ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid #A08068', borderTopColor: '#F26722', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
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
          <div style={{ background: '#FFF0E8', borderRadius: 10, padding: '12px 16px', width: '100%' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#C4511A', marginBottom: 6 }}>💡 使い方</p>
            <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['QRコード素材をダウンロード（PNG・高解像度）',
                'Canva / Illustrator / Figma などに素材として読み込む',
                'お好みの名刺デザインに配置・調整',
                '印刷会社や自宅プリンターで印刷'].map(s => (
                <li key={s} style={{ fontSize: 11, color: '#4A2C1A', lineHeight: 1.6 }}>{s}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* 印刷会社向け情報 */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDD9C8', padding: 20, maxWidth: 520, width: '100%', boxShadow: '0 1px 4px rgba(242,103,34,0.06)' }}>
          <p style={{ fontSize: 13, fontWeight: 900, color: '#1C0F05', marginBottom: 14 }}>印刷会社への入稿について</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '📐', text: '仕上がりサイズ: 91×55mm（標準名刺サイズ）' },
              { icon: '🖨️', text: '解像度: 350dpi 相当（印刷品質）で保存されます' },
              { icon: '🎨', text: 'カラーモード: RGB（印刷会社でCMYKに変換を依頼）' },
              { icon: '✂️', text: '塗り足し: 必要な場合は印刷会社に3mm塗り足し追加を依頼' },
              { icon: '📄', text: 'ファイル形式: PDF（表面+裏面2ページ）またはPNG単体での入稿も可' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
                <span style={{ fontSize: 12, color: '#4A2C1A', lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#FAF5F0', borderRadius: 10 }}>
            <p style={{ fontSize: 11, color: '#A08068', lineHeight: 1.6, margin: 0 }}>
              💡 「入稿用PDFを保存」で表面+裏面が1つのPDFファイル（91×55mm · 2ページ）として出力されます。印刷会社への入稿に直接使えます。PNG単体で入稿する場合は各カード下の「表面を保存」「裏面を保存」をご利用ください。
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
