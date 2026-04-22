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

type Design = 'executive' | 'midnight' | 'vivid' | 'ocean' | 'forest' | 'crimson' | 'gold' | 'pink'
type Font   = 'sans' | 'serif' | 'rounded' | 'mono' | 'display' | 'elegant' | 'yumin'
type Layout = 'standard' | 'centered' | 'split' | 'pulse'

const layoutMeta: Record<Layout, { label: string; desc: string }> = {
  standard: { label: 'スタンダード', desc: '左揃え・定番' },
  centered: { label: 'センター',    desc: '中央揃え・洗練' },
  split:    { label: 'スプリット',  desc: 'パネル分割・モダン' },
  pulse:    { label: 'PULSE',       desc: 'AI前面・生きた名刺' },
}

/* テーマカラー設定 — レイアウト共通コンポーネントに渡す */
type TC = {
  frontBg: string       // 表面の背景
  panelBg: string       // スプリット左パネル背景
  textName: string      // 氏名の色
  textCompany: string   // 会社名の色
  textContact: string   // 連絡先テキストの色
  accent: string        // アクセントカラー
  isDark: boolean       // 背景が暗いか（ロゴフィルター用）
  qrWrap: React.CSSProperties  // QRコンテナのスタイル
}
const TC: Record<Design, TC> = {
  executive: { frontBg:'#FFFFFF', panelBg:'linear-gradient(180deg,#C4511A,#F26722)', textName:'#1C0F05', textCompany:'#F26722', textContact:'#4A2C1A', accent:'#F26722', isDark:false, qrWrap:{ border:'1.5px solid #E0E7FF', borderRadius:8 } },
  midnight:  { frontBg:'#0D0C2A', panelBg:'linear-gradient(180deg,#060520,#150E3A)', textName:'#FFFFFF', textCompany:'#F5A47A', textContact:'rgba(255,255,255,0.55)', accent:'#F5A47A', isDark:true, qrWrap:{ background:'white', padding:5, borderRadius:10, boxShadow:'0 0 20px rgba(242,103,34,0.3)' } },
  vivid:     { frontBg:'linear-gradient(135deg,#C4511A 0%,#F26722 40%,#F59340 100%)', panelBg:'linear-gradient(180deg,#8B3010,#C4511A)', textName:'#FFFFFF', textCompany:'rgba(255,255,255,0.8)', textContact:'rgba(255,255,255,0.75)', accent:'#FFFFFF', isDark:true, qrWrap:{ background:'white', padding:5, borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.25)' } },
  ocean:     { frontBg:'linear-gradient(135deg,#0B2A4A 0%,#0B4F7A 50%,#0D7A7A 100%)', panelBg:'linear-gradient(180deg,#062033,#0B4F7A)', textName:'#FFFFFF', textCompany:'#7EF2E8', textContact:'rgba(255,255,255,0.6)', accent:'#7EF2E8', isDark:true, qrWrap:{ background:'white', padding:5, borderRadius:10, boxShadow:'0 0 20px rgba(13,212,200,0.4)' } },
  forest:    { frontBg:'linear-gradient(135deg,#0A2A1C 0%,#0F3D2E 50%,#145A3E 100%)', panelBg:'linear-gradient(180deg,#051510,#0F3D2E)', textName:'#FFFFFF', textCompany:'#6EE7B7', textContact:'rgba(255,255,255,0.6)', accent:'#6EE7B7', isDark:true, qrWrap:{ background:'white', padding:5, borderRadius:10, boxShadow:'0 0 18px rgba(52,211,153,0.35)' } },
  crimson:   { frontBg:'linear-gradient(135deg,#3D0010 0%,#7A0B2A 50%,#A01040 100%)', panelBg:'linear-gradient(180deg,#1A0008,#7A0B2A)', textName:'#FFFFFF', textCompany:'#FECDD3', textContact:'rgba(255,255,255,0.65)', accent:'#FECDD3', isDark:true, qrWrap:{ background:'white', padding:5, borderRadius:10, boxShadow:'0 0 18px rgba(244,63,94,0.4)' } },
  gold:      { frontBg:'#0A0A0A', panelBg:'linear-gradient(180deg,#040400,#1A1200)', textName:'#F5E6A3', textCompany:'#D4AF37', textContact:'rgba(245,230,163,0.6)', accent:'#D4AF37', isDark:true, qrWrap:{ background:'white', padding:5, borderRadius:10, boxShadow:'0 0 20px rgba(212,175,55,0.4)' } },
  pink:      { frontBg:'linear-gradient(135deg,#FDF2F8 0%,#FCE7F3 50%,#FBD5EA 100%)', panelBg:'linear-gradient(180deg,#9D174D,#EC4899)', textName:'#831843', textCompany:'#BE185D', textContact:'#9D174D', accent:'#EC4899', isDark:false, qrWrap:{ border:'1.5px solid #FBCFE8', borderRadius:8 } },
}

const SPLIT_X = 210  // スプリットレイアウトの左パネル幅 (px)

const designMeta: Record<Design, { label: string; desc: string; preview: string }> = {
  executive: { label: '白藍',   desc: '上質な白 × インディゴ',  preview: '#FFFFFF' },
  midnight:  { label: '黒紫',   desc: '漆黒 × バイオレット',    preview: '#0D0C2A' },
  vivid:     { label: '炎橙',   desc: 'オレンジグラデ',          preview: '#F26722' },
  ocean:     { label: '海碧',   desc: '深海ブルー × ティール',  preview: '#0B4F7A' },
  forest:    { label: '翠緑',   desc: '深森グリーン × エメラルド', preview: '#0F3D2E' },
  crimson:   { label: '深紅',   desc: 'ディープレッド × ローズ', preview: '#7A0B2A' },
  gold:      { label: '金黒',   desc: '漆黒 × プレミアムゴールド', preview: '#0A0A0A' },
  pink:      { label: '桜',     desc: 'チェリーブロッサム × ピンク', preview: '#F472B6' },
}

const fontMeta: Record<Font, { label: string; desc: string; family: string }> = {
  sans:    { label: 'ゴシック',   desc: '現代的・読みやすい',    family: "'Helvetica Neue', 'Hiragino Sans', 'Yu Gothic', Arial, sans-serif" },
  serif:   { label: '明朝',       desc: '格調・クラシック',      family: "'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif" },
  rounded: { label: '丸ゴシ',    desc: '親しみやすい・柔らか',   family: "'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', system-ui, sans-serif" },
  mono:    { label: '等幅',       desc: 'テック・エンジニア',    family: "'SFMono-Regular', 'Menlo', 'Consolas', 'Courier New', monospace" },
  display: { label: '太字',       desc: '力強い・インパクト',    family: "'Arial Black', 'Impact', 'Hiragino Sans', sans-serif" },
  elegant: { label: '細身',       desc: '上品・洗練・スリム',    family: "'Optima', 'Candara', 'Century Gothic', 'Gill Sans', sans-serif" },
  yumin:   { label: '游明朝',     desc: '和の格式・重厚',        family: "'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', 'MS PMincho', serif" },
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
      errorCorrectionLevel: 'H',   // 30%訂正 — ロゴ重ねてもスキャン可能
      color: { dark: '#1C0F05', light: '#FFFFFF' },
    }).then(svgStr => {
      setSvg(svgStr.replace(/(<svg[^>]*)\swidth="[^"]*"\sheight="[^"]*"/, '$1 width="100%" height="100%"'))
    }).catch(() => {})
  }, [url, size])

  const logoSize = Math.round(size * 0.22)   // QRサイズの22%
  const bgSize   = logoSize + 6              // 白丸の余白

  return (
    <div style={{ width: size, height: size, display: 'block', flexShrink: 0, position: 'relative', ...style }}>
      {/* QR本体 */}
      <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      {/* 中央ロゴ */}
      {svg && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: bgSize, height: bgSize,
          borderRadius: '50%',
          background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1.5px rgba(0,0,0,0.07)',
          pointerEvents: 'none',
        }}>
          <LogoIcon size={logoSize} />
        </div>
      )}
    </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A2C1A', fontSize: 13 }}>
              <span style={{ color: '#F26722' }}><IconMail /></span>
              {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A2C1A', fontSize: 13 }}>
              <span style={{ color: '#F26722' }}><IconPhone /></span>
              {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#4A2C1A', fontSize: 13 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              <span style={{ color: '#F5A47A' }}><IconMail /></span> {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              <span style={{ color: '#F5A47A' }}><IconPhone /></span> {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              <IconMail /> {card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              <IconPhone /> {card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
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
   OCEAN — 深海ブルー × ティール
══════════════════════════════════════════ */
function OceanFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #0B2A4A 0%, #0B4F7A 50%, #0D7A7A 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Wave decorations */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,200,200,0.18) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,122,122,0.25) 0%, transparent 70%)' }} />
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 34, height: 1, background: 'rgba(255,255,255,0.04)' }} />
      ))}
      {/* Top cyan line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #0DD4C8, #7EF2E8, transparent)' }} />
      {/* User logo */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', opacity: 0.8, pointerEvents: 'none' }} />}
      {/* Content */}
      <div style={{ position: 'absolute', left: 32, top: 30, bottom: 36, right: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && <p style={{ fontSize: 8, color: '#7EF2E8', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px' }}>{card.company}</p>}
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{card.full_name}</h2>
          {card.title && <p style={{ fontSize: 11, color: '#7EF2E8', fontWeight: 600, margin: 0 }}>{card.title}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}><span style={{ color: '#7EF2E8' }}><IconMail /></span>{card.email}</div>}
          {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}><span style={{ color: '#7EF2E8' }}><IconPhone /></span>{card.phone}</div>}
          {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}><span style={{ color: '#7EF2E8' }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
        </div>
      </div>
      {qrUrl && (
        <div style={{ position: 'absolute', right: 20, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} /><span style={{ fontSize: 7, fontWeight: 800, color: '#7EF2E8', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 0 20px rgba(13,212,200,0.4)' }}>
            <QRCodeSVG url={qrUrl} size={68} />
          </div>
          <p style={{ fontSize: 7, color: '#7EF2E8', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #0DD4C8, transparent)' }} />
    </div>
  )
}
function OceanBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(160deg, #071828 0%, #0B2A4A 60%, #0B4F7A 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(13,212,200,0.12) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(126,242,232,0.4), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(126,242,232,0.4), transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14 }}><LogoIcon size={40} /></div>
        <p style={{ fontSize: 8, color: '#7EF2E8', fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.25 }}>QRをスキャンして<br />分身AIと話してください</h3>
        {card.short_intro && <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 300 }}>{card.short_intro}</p>}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #7EF2E8, transparent)', marginBottom: 16 }} />
        <div style={{ marginTop: 12 }}><BackBrandLogo /></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   FOREST — 深森グリーン × エメラルド
══════════════════════════════════════════ */
function ForestFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #0A2A1C 0%, #0F3D2E 50%, #145A3E 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Nature orbs */}
      <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)' }} />
      {[...Array(9)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 38, height: 1, background: 'rgba(255,255,255,0.03)' }} />
      ))}
      {/* Top emerald line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #34D399, #A7F3D0, transparent)' }} />
      {/* Left accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'linear-gradient(180deg, #34D399, #10B981)' }} />
      {/* User logo */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', opacity: 0.8, pointerEvents: 'none' }} />}
      {/* Content */}
      <div style={{ position: 'absolute', left: 36, top: 30, bottom: 36, right: 118, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && <p style={{ fontSize: 8, color: '#6EE7B7', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px' }}>{card.company}</p>}
          <h2 style={{ fontSize: 27, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{card.full_name}</h2>
          {card.title && <p style={{ fontSize: 11, color: '#6EE7B7', fontWeight: 600, margin: 0 }}>{card.title}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}><span style={{ color: '#6EE7B7' }}><IconMail /></span>{card.email}</div>}
          {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}><span style={{ color: '#6EE7B7' }}><IconPhone /></span>{card.phone}</div>}
          {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}><span style={{ color: '#6EE7B7' }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
        </div>
      </div>
      {qrUrl && (
        <div style={{ position: 'absolute', right: 20, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} /><span style={{ fontSize: 7, fontWeight: 800, color: '#6EE7B7', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 0 18px rgba(52,211,153,0.35)' }}>
            <QRCodeSVG url={qrUrl} size={68} />
          </div>
          <p style={{ fontSize: 7, color: '#6EE7B7', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 5, right: 0, height: 2, background: 'linear-gradient(90deg, #34D399, #A7F3D0 60%, transparent)' }} />
    </div>
  )
}
function ForestBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(160deg, #061610 0%, #0A2A1C 60%, #0F3D2E 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, height: 280, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(52,211,153,0.1) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(110,231,183,0.4), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(110,231,183,0.4), transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14 }}><LogoIcon size={40} /></div>
        <p style={{ fontSize: 8, color: '#6EE7B7', fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.25 }}>QRをスキャンして<br />分身AIと話してください</h3>
        {card.short_intro && <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 300 }}>{card.short_intro}</p>}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #6EE7B7, transparent)', marginBottom: 16 }} />
        <div style={{ marginTop: 12 }}><BackBrandLogo /></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   CRIMSON — ディープレッド × ローズ
══════════════════════════════════════════ */
function CrimsonFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #3D0010 0%, #7A0B2A 50%, #A01040 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Rose glow */}
      <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,113,133,0.2) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.18) 0%, transparent 70%)' }} />
      {[...Array(9)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 38, height: 1, background: 'rgba(255,255,255,0.04)' }} />
      ))}
      {/* Top rose line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #FB7185, #FECDD3, transparent)' }} />
      {/* Right accent */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, background: 'linear-gradient(180deg, #FB7185, #F43F5E)' }} />
      {/* User logo */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', opacity: 0.8, pointerEvents: 'none' }} />}
      {/* Content */}
      <div style={{ position: 'absolute', left: 32, top: 30, bottom: 36, right: 125, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && <p style={{ fontSize: 8, color: '#FECDD3', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 10px' }}>{card.company}</p>}
          <h2 style={{ fontSize: 27, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{card.full_name}</h2>
          {card.title && <p style={{ fontSize: 11, color: '#FECDD3', fontWeight: 600, margin: 0 }}>{card.title}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13 }}><span style={{ color: '#FECDD3' }}><IconMail /></span>{card.email}</div>}
          {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13 }}><span style={{ color: '#FECDD3' }}><IconPhone /></span>{card.phone}</div>}
          {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13 }}><span style={{ color: '#FECDD3' }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
        </div>
      </div>
      {qrUrl && (
        <div style={{ position: 'absolute', right: 22, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} /><span style={{ fontSize: 7, fontWeight: 800, color: '#FECDD3', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 0 18px rgba(244,63,94,0.4)' }}>
            <QRCodeSVG url={qrUrl} size={68} />
          </div>
          <p style={{ fontSize: 7, color: '#FECDD3', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 5, height: 2, background: 'linear-gradient(90deg, transparent 20%, #FB7185, #FECDD3)' }} />
    </div>
  )
}
function CrimsonBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(160deg, #1C0008 0%, #3D0010 60%, #7A0B2A 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, height: 280, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(244,63,94,0.12) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(254,205,211,0.4), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(254,205,211,0.4), transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14 }}><LogoIcon size={40} /></div>
        <p style={{ fontSize: 8, color: '#FECDD3', fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.25 }}>QRをスキャンして<br />分身AIと話してください</h3>
        {card.short_intro && <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 300 }}>{card.short_intro}</p>}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #FECDD3, transparent)', marginBottom: 16 }} />
        <div style={{ marginTop: 12 }}><BackBrandLogo /></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   GOLD — 漆黒 × プレミアムゴールド
══════════════════════════════════════════ */
function GoldFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#0A0A0A', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Gold shimmer */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -30, left: 100, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)' }} />
      {/* Grid lines */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: i * 70, top: 0, bottom: 0, width: 1, background: 'rgba(212,175,55,0.05)' }} />
      ))}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: i * 70, left: 0, right: 0, height: 1, background: 'rgba(212,175,55,0.05)' }} />
      ))}
      {/* Gold top border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #B8960C, #F0D060, #D4AF37, transparent)' }} />
      {/* Left gold accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'linear-gradient(180deg, #B8960C, #F0D060, #B8960C)' }} />
      {/* User logo */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', filter: 'sepia(1) saturate(2) hue-rotate(5deg) brightness(1.2)', opacity: 0.9, pointerEvents: 'none' }} />}
      {/* Content */}
      <div style={{ position: 'absolute', left: 32, top: 0, bottom: 0, right: 112, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {card.company && <p style={{ fontSize: 8, color: '#D4AF37', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', margin: '0 0 12px' }}>{card.company}</p>}
        <h2 style={{ fontSize: 27, fontWeight: 900, color: '#F5E6A3', margin: '0 0 4px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{card.full_name}</h2>
        {card.title && <p style={{ fontSize: 11, color: '#D4AF37', fontWeight: 600, margin: '0 0 18px' }}>{card.title}</p>}
        <div style={{ width: 36, height: 1, background: 'linear-gradient(90deg, #D4AF37, transparent)', marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(245,230,163,0.6)', fontSize: 13 }}><span style={{ color: '#D4AF37' }}><IconMail /></span>{card.email}</div>}
          {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(245,230,163,0.6)', fontSize: 13 }}><span style={{ color: '#D4AF37' }}><IconPhone /></span>{card.phone}</div>}
          {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(245,230,163,0.6)', fontSize: 13 }}><span style={{ color: '#D4AF37' }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
        </div>
      </div>
      {qrUrl && (
        <div style={{ position: 'absolute', right: 18, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} /><span style={{ fontSize: 7, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={{ background: 'white', padding: 5, borderRadius: 10, boxShadow: '0 0 20px rgba(212,175,55,0.4)' }}>
            <QRCodeSVG url={qrUrl} size={68} />
          </div>
          <p style={{ fontSize: 7, color: '#D4AF37', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 4, right: 0, height: 1, background: 'linear-gradient(90deg, #B8960C, #F0D060 60%, transparent)' }} />
    </div>
  )
}
function GoldBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#050505', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: i * 70, top: 0, bottom: 0, width: 1, background: 'rgba(212,175,55,0.04)' }} />
      ))}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: i * 70, left: 0, right: 0, height: 1, background: 'rgba(212,175,55,0.04)' }} />
      ))}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360, height: 260, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(212,175,55,0.1) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #B8960C, #F0D060, #D4AF37, transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #B8960C, #F0D060, #D4AF37, transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14 }}><LogoIcon size={40} /></div>
        <p style={{ fontSize: 8, color: '#D4AF37', fontWeight: 700, letterSpacing: '0.22em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: '#F5E6A3', margin: '0 0 14px', lineHeight: 1.25 }}>QRをスキャンして<br />分身AIと話してください</h3>
        {card.short_intro && <p style={{ fontSize: 9.5, color: 'rgba(212,175,55,0.5)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 300 }}>{card.short_intro}</p>}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)', marginBottom: 16 }} />
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LogoIcon size={20} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#D4AF37', letterSpacing: '-0.01em', lineHeight: 1 }}>AI名刺</div>
              <div style={{ fontSize: 6.5, color: 'rgba(212,175,55,0.5)', fontWeight: 600, letterSpacing: '0.08em', marginTop: 1 }}>次世代名刺</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   PINK — チェリーブロッサム × ホットピンク
══════════════════════════════════════════ */
function PinkFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14 }: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 50%, #FBD5EA 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Petal orbs */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,114,182,0.22) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 60, left: 180, width: 80, height: 80, borderRadius: '50%', background: 'rgba(244,114,182,0.08)' }} />
      {/* Top pink border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #F9A8D4, #EC4899, #F472B6, #F9A8D4)' }} />
      {/* Left accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'linear-gradient(180deg, #EC4899, #F472B6, #FBCFE8)' }} />
      {/* Decorative petals */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'rgba(236,72,153,0.12)', top: 20 + i * 52, right: 108 + (i % 2) * 8 }} />
      ))}
      {/* User logo */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 26, maxWidth: 90, objectFit: 'contain', objectPosition: 'left', pointerEvents: 'none' }} />}
      {/* Content */}
      <div style={{ position: 'absolute', left: 32, top: 0, bottom: 0, right: 112, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
        {card.company && <p style={{ fontSize: 9, color: '#BE185D', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, margin: '0 0 8px' }}>{card.company}</p>}
        <h2 style={{ fontSize: 26, fontWeight: 900, color: '#831843', margin: '0 0 4px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{card.full_name}</h2>
        {card.title && <p style={{ fontSize: 11, color: '#EC4899', fontWeight: 600, margin: '0 0 18px' }}>{card.title}</p>}
        <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, #EC4899, #F9A8D4)', borderRadius: 2, marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#9D174D', fontSize: 13 }}><span style={{ color: '#EC4899' }}><IconMail /></span>{card.email}</div>}
          {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#9D174D', fontSize: 13 }}><span style={{ color: '#EC4899' }}><IconPhone /></span>{card.phone}</div>}
          {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#9D174D', fontSize: 13 }}><span style={{ color: '#EC4899' }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
        </div>
      </div>
      {qrUrl && (
        <div style={{ position: 'absolute', right: 18, bottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <LogoIcon size={12} /><span style={{ fontSize: 7, fontWeight: 800, color: '#BE185D', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <QRCodeSVG url={qrUrl} size={74} style={{ border: '1.5px solid #FBCFE8', borderRadius: 8 }} />
          <p style={{ fontSize: 7, color: '#F472B6', margin: 0, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 5, right: 0, height: 3, background: 'linear-gradient(90deg, #EC4899 0%, #F472B6 50%, transparent 100%)' }} />
    </div>
  )
}
function PinkBack({ card, fontFamily }: { card: BusinessCard; fontFamily?: string }) {
  return (
    <div className="print-card" style={{ width: W, height: H, background: 'linear-gradient(160deg, #831843 0%, #9D174D 40%, #BE185D 100%)', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, height: 280, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(249,168,212,0.18) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: -30, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(249,168,212,0.5), transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(249,168,212,0.5), transparent)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14 }}><LogoIcon size={40} /></div>
        <p style={{ fontSize: 8, color: '#FBCFE8', fontWeight: 700, letterSpacing: '0.18em', margin: '0 0 10px' }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: '0 0 14px', lineHeight: 1.25 }}>QRをスキャンして<br />分身AIと話してください</h3>
        {card.short_intro && <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.6)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 300 }}>{card.short_intro}</p>}
        <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg, transparent, #F9A8D4, transparent)', marginBottom: 16 }} />
        <div style={{ marginTop: 12 }}><BackBrandLogo /></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   CENTERED — 中央揃えレイアウト（全テーマ共通）
══════════════════════════════════════════ */
function CenteredFront({ card, qrUrl, fontFamily, logoUrl, logoX = 32, logoY = 14, tc }: {
  card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number; tc: TC
}) {
  const { frontBg, textName, textCompany, textContact, accent, isDark, qrWrap } = tc
  return (
    <div className="print-card" style={{ width: W, height: H, background: frontBg, position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* 装飾 orb */}
      <div style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} 0%, transparent 70%)` }} />
      <div style={{ position: 'absolute', bottom: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} 0%, transparent 70%)` }} />
      {/* 上下アクセントライン */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      {/* ロゴ */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 24, maxWidth: 80, objectFit: 'contain', objectPosition: 'left', filter: isDark ? 'brightness(0) invert(1)' : undefined, opacity: 0.85, pointerEvents: 'none' }} />}
      {/* センター本文 */}
      <div style={{ position: 'absolute', left: 28, right: 112, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {card.company && <p style={{ fontSize: 8, color: textCompany, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, margin: '0 0 14px' }}>{card.company}</p>}
        <h2 style={{ fontSize: 28, fontWeight: 900, color: textName, margin: '0 0 7px', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{card.full_name}</h2>
        {card.title && <p style={{ fontSize: 11, color: accent, fontWeight: 600, margin: '0 0 18px' }}>{card.title}</p>}
        <div style={{ width: 50, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, marginBottom: 16 }} />
        {/* 連絡先：縦並び（中央揃え） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textContact, fontSize: 13 }}><span style={{ color: accent }}><IconMail /></span>{card.email}</div>}
          {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textContact, fontSize: 13 }}><span style={{ color: accent }}><IconPhone /></span>{card.phone}</div>}
          {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textContact, fontSize: 13 }}><span style={{ color: accent }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
        </div>
      </div>
      {/* QR + ブランド — 右下 */}
      {qrUrl && (
        <div style={{ position: 'absolute', right: 18, bottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
            <LogoIcon size={11} /><span style={{ fontSize: 6.5, fontWeight: 800, color: accent, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>AI名刺</span>
          </div>
          <div style={qrWrap}><QRCodeSVG url={qrUrl} size={64} /></div>
          <p style={{ fontSize: 6.5, color: accent, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   SPLIT — 左パネル分割レイアウト（全テーマ共通）
══════════════════════════════════════════ */
function SplitFront({ card, qrUrl, fontFamily, logoUrl, logoX = SPLIT_X + 18, logoY = 16, tc }: {
  card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number; tc: TC
}) {
  const { panelBg, textCompany, textContact, accent, qrWrap } = tc
  const rightBg = tc.isDark ? '#F8F4F0' : '#FFFFFF'
  const rightText = '#1C0F05'
  const rightSecondary = '#4A2C1A'
  return (
    <div className="print-card" style={{ width: W, height: H, background: rightBg, position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* 左パネル */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SPLIT_X, background: panelBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* 大きな頭文字ウォーターマーク */}
        <div style={{ position: 'absolute', fontSize: 150, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, userSelect: 'none' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          {card.full_name[0]}
        </div>
        {/* 氏名・役職 */}
        <div style={{ position: 'relative', textAlign: 'center', padding: '0 14px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', margin: 0, lineHeight: 1.25, letterSpacing: '-0.01em', wordBreak: 'break-all' as const }}>{card.full_name}</h2>
          {card.title && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', margin: '6px 0 0', fontWeight: 600, lineHeight: 1.4 }}>{card.title}</p>}
        </div>
        {/* パネル下部ブランドマーク */}
        <div style={{ position: 'absolute', bottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <LogoIcon size={10} />
          <span style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>AI名刺</span>
        </div>
      </div>
      {/* 右パネル */}
      <div style={{ position: 'absolute', left: SPLIT_X, top: 0, right: 0, bottom: 0, background: rightBg, padding: '22px 16px 18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {card.company && <p style={{ fontSize: 8, color: accent, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, margin: '0 0 10px' }}>{card.company}</p>}
          <div style={{ width: 22, height: 2.5, background: accent, borderRadius: 2, marginBottom: 14 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {card.email && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: rightSecondary, fontSize: 13 }}><span style={{ color: accent }}><IconMail /></span>{card.email}</div>}
            {card.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: rightSecondary, fontSize: 13 }}><span style={{ color: accent }}><IconPhone /></span>{card.phone}</div>}
            {card.website && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: rightSecondary, fontSize: 13 }}><span style={{ color: accent }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}</div>}
          </div>
        </div>
        {qrUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <div style={qrWrap}><QRCodeSVG url={qrUrl} size={60} /></div>
            <p style={{ fontSize: 6.5, color: accent, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>スキャンしてAI相談</p>
          </div>
        )}
      </div>
      {/* ロゴ（右パネル上部） */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 22, maxWidth: 76, objectFit: 'contain', objectPosition: 'left', pointerEvents: 'none' }} />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   PULSE — QR主役 × EKG鼓動 × AI LIVE（全テーマ共通・常時ダーク）
══════════════════════════════════════════════════════════ */
// EKG心拍パス（viewBox 0 0 220 20）
const EKG_PATH = 'M 0 10 L 22 10 L 28 10 L 34 5 L 40 15 L 46 1 L 52 19 L 58 10 L 64 10 L 220 10'

function PulseFront({ card, qrUrl, fontFamily, logoUrl, logoX = 238, logoY = 13, tc }: {
  card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number; tc: TC
}) {
  const { accent } = tc
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#060614', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>

      {/* ── 背景グリッド ── */}
      {[...Array(12)].map((_, i) => (
        <div key={`v${i}`} style={{ position: 'absolute', left: i * 47, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.022)' }} />
      ))}
      {[...Array(8)].map((_, i) => (
        <div key={`h${i}`} style={{ position: 'absolute', top: i * 48, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.022)' }} />
      ))}

      {/* ── 左グロー ── */}
      <div style={{ position: 'absolute', left: -40, top: '50%', transform: 'translateY(-50%)', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${accent}28 0%, transparent 65%)`, pointerEvents: 'none' }} />

      {/* ── TOP バー ── */}
      {/* AI LIVE バッジ */}
      <div style={{ position: 'absolute', top: 14, left: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 8px #4ADE8088' }} />
        <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.45)', fontWeight: 800, letterSpacing: '0.16em' }}>AI LIVE</span>
      </div>
      {/* 会社名 */}
      {card.company && (
        <div style={{ position: 'absolute', top: 13, right: 18 }}>
          <span style={{ fontSize: 7.5, color: accent, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, opacity: 0.9 }}>{card.company}</span>
        </div>
      )}

      {/* ── 左ゾーン: QRコード（主役） ── */}
      <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {/* QR グロー台座 */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -12, borderRadius: 22, background: `radial-gradient(circle, ${accent}20 0%, transparent 72%)`, pointerEvents: 'none' }} />
          <div style={{
            background: 'white', padding: 7, borderRadius: 14, position: 'relative',
            boxShadow: `0 0 0 1px ${accent}50, 0 0 24px ${accent}35, 0 8px 32px rgba(0,0,0,0.5)`,
          }}>
            <QRCodeSVG url={qrUrl} size={128} style={{ borderRadius: 6 }} />
          </div>
        </div>
        {/* SCAN CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 7.5, color: accent, fontWeight: 900, letterSpacing: '0.14em' }}>SCAN</span>
          <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
            <path d="M0 4h12M9 1l3 3-3 3" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em' }}>分身AIと対話</span>
        </div>
      </div>

      {/* ── 縦分割線 ── */}
      <div style={{ position: 'absolute', left: 222, top: 20, bottom: 20, width: 1, background: `linear-gradient(180deg, transparent, ${accent}70 30%, ${accent}70 70%, transparent)` }} />

      {/* ── 右ゾーン: 名前・連絡先 ── */}
      <div style={{ position: 'absolute', left: 236, right: 18, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* 氏名 */}
        <h2 style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', margin: '0 0 5px', lineHeight: 1.05, letterSpacing: '-0.025em' }}>{card.full_name}</h2>
        {/* 役職 */}
        {card.title && (
          <p style={{ fontSize: 10.5, color: accent, fontWeight: 700, margin: '0 0 16px', letterSpacing: '0.02em' }}>{card.title}</p>
        )}
        {/* EKG 鼓動ライン */}
        <div style={{ marginBottom: 14, overflow: 'visible' }}>
          <svg width="220" height="20" viewBox="0 0 220 20" fill="none" style={{ overflow: 'visible' }}>
            {/* グロー層 */}
            <path d={EKG_PATH} stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.12"/>
            {/* メイン線 */}
            <path d={EKG_PATH} stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
            {/* スパイク頂点のドット */}
            <circle cx="46" cy="1" r="2" fill={accent} opacity="0.9"/>
          </svg>
        </div>
        {/* 連絡先 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {card.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              <span style={{ color: accent, opacity: 0.9 }}><IconMail /></span>{card.email}
            </div>
          )}
          {card.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              <span style={{ color: accent, opacity: 0.9 }}><IconPhone /></span>{card.phone}
            </div>
          )}
          {card.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              <span style={{ color: accent, opacity: 0.9 }}><IconGlobe /></span>{card.website.replace(/https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* ── ロゴ ── */}
      {logoUrl && <img src={logoUrl} alt="logo" style={{ position: 'absolute', top: logoY, left: logoX, maxHeight: 20, maxWidth: 76, objectFit: 'contain', objectPosition: 'left', filter: 'brightness(0) invert(1)', opacity: 0.55, pointerEvents: 'none' }} />}

      {/* ── 下ボーダー ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}90, ${accent}, ${accent}90, transparent)` }} />
    </div>
  )
}

function PulseBack({ card, fontFamily, tc }: { card: BusinessCard; fontFamily?: string; tc: TC }) {
  const { accent } = tc
  return (
    <div className="print-card" style={{ width: W, height: H, background: '#060614', position: 'relative', overflow: 'hidden', fontFamily: fontFamily ?? "'Helvetica Neue', Arial, sans-serif" }}>
      {/* 背景グリッド */}
      {[...Array(12)].map((_, i) => (
        <div key={`v${i}`} style={{ position: 'absolute', left: i * 47, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.018)' }} />
      ))}
      {[...Array(8)].map((_, i) => (
        <div key={`h${i}`} style={{ position: 'absolute', top: i * 48, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.018)' }} />
      ))}
      {/* センターグロー */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360, height: 260, borderRadius: '50%', background: `radial-gradient(ellipse, ${accent}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
      {/* 上下ライン */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}80, ${accent}, ${accent}80, transparent)` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}80, ${accent}, ${accent}80, transparent)` }} />

      {/* 本文 */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 48px', textAlign: 'center' }}>
        {/* ブランドロゴ */}
        <div style={{ marginBottom: 18, filter: `drop-shadow(0 0 12px ${accent}80)` }}>
          <LogoIcon size={44} />
        </div>
        {/* キャッチコピー */}
        <p style={{ fontSize: 8, color: accent, fontWeight: 800, letterSpacing: '0.2em', margin: '0 0 12px', textTransform: 'uppercase' as const }}>分身AI搭載名刺</p>
        <h3 style={{ fontSize: 19, fontWeight: 900, color: '#FFFFFF', margin: '0 0 8px', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          名刺をスキャンすると<br />私のAIと話せます
        </h3>
        {card.short_intro && (
          <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', margin: '0 0 18px', lineHeight: 1.65, maxWidth: 300 }}>{card.short_intro}</p>
        )}
        {/* EKG ライン */}
        <div style={{ width: '100%', maxWidth: 320, marginBottom: 16 }}>
          <svg width="100%" height="16" viewBox="0 0 320 16" fill="none" preserveAspectRatio="none">
            <path d="M 0 8 L 100 8 L 106 8 L 112 4 L 118 12 L 124 1 L 130 15 L 136 8 L 142 8 L 320 8" stroke={accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
            <path d="M 0 8 L 100 8 L 106 8 L 112 4 L 118 12 L 124 1 L 130 15 L 136 8 L 142 8 L 320 8" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.1"/>
            <circle cx="124" cy="1" r="2" fill={accent} opacity="0.85"/>
          </svg>
        </div>
        {/* AI LIVE バッジ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${accent}18`, borderRadius: 20, padding: '6px 14px', border: `1px solid ${accent}35` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 8px #4ADE8088', flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.06em' }}>24時間 / 365日 / オンライン待機中</span>
        </div>
      </div>

      {/* ブランドロゴ */}
      <div style={{ position: 'absolute', bottom: 14, right: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LogoIcon size={16} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: accent, letterSpacing: '-0.01em', lineHeight: 1 }}>AI名刺</div>
            <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.08em', marginTop: 1 }}>次世代名刺</div>
          </div>
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
  const [layout, setLayout] = useState<Layout>('standard')
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
          if (cfg.theme  && cfg.theme  in designMeta) setDesign(cfg.theme  as Design)
          if (cfg.font   && cfg.font   in fontMeta)   setFont(cfg.font   as Font)
          if (cfg.layout && cfg.layout in layoutMeta) setLayout(cfg.layout as Layout)
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
        body: JSON.stringify({ style_config: { theme: design, font, layout, logoUrl: logoUrl || null, logoX, logoY } }),
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

  const standardBackMap: Record<Design, React.ComponentType<{ card: BusinessCard; fontFamily?: string }>> = {
    executive: ExecutiveBack, midnight: MidnightBack, vivid: VividBack,
    ocean: OceanBack, forest: ForestBack, crimson: CrimsonBack, gold: GoldBack, pink: PinkBack,
  }
  const tc = TC[design]
  const BackComponent = layout === 'pulse'
    ? (p: { card: BusinessCard; fontFamily?: string }) => <PulseBack {...p} tc={tc} />
    : standardBackMap[design]

  // レイアウト × カラー でフロントコンポーネントを決定
  const standardMap: Record<Design, React.ComponentType<{ card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }>> = {
    executive: ExecutiveFront, midnight: MidnightFront, vivid: VividFront,
    ocean: OceanFront, forest: ForestFront, crimson: CrimsonFront, gold: GoldFront, pink: PinkFront,
  }
  const FrontComponent = layout === 'standard'
    ? standardMap[design]
    : layout === 'centered'
      ? (p: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) =>
          <CenteredFront {...p} tc={tc} />
      : layout === 'split'
        ? (p: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) =>
            <SplitFront {...p} tc={tc} />
        : (p: { card: BusinessCard; qrUrl: string; fontFamily?: string; logoUrl?: string; logoX?: number; logoY?: number }) =>
            <PulseFront {...p} tc={tc} />

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

          {/* 行2: カラー選択（7色グリッド） */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A08068', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 36, paddingTop: 7 }}>カラー</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, flex: 1 }}>
              {(Object.entries(designMeta) as [Design, typeof designMeta[Design]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setDesign(key)} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: design === key ? '#F26722' : 'white',
                  color: design === key ? 'white' : '#4A2C1A',
                  border: `1.5px solid ${design === key ? 'transparent' : '#EDD9C8'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: design === key ? '0 2px 8px rgba(242,103,34,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.preview, border: design === key ? '1.5px solid rgba(255,255,255,0.5)' : '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* 行3: レイアウト選択 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A08068', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 36 }}>配置</span>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {(Object.entries(layoutMeta) as [Layout, typeof layoutMeta[Layout]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setLayout(key)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: layout === key ? '#1C0F05' : 'white',
                  color: layout === key ? 'white' : '#4A2C1A',
                  border: `1.5px solid ${layout === key ? 'transparent' : '#EDD9C8'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: layout === key ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  {/* ミニプレビューアイコン */}
                  {key === 'standard' && (
                    <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                      <rect x="1" y="1" width="13" height="12" rx="1.5" fill={layout === key ? 'rgba(255,255,255,0.15)' : '#F0E8E0'} stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#DEC4AD'} strokeWidth="0.8"/>
                      <rect x="16" y="1" width="5" height="5" rx="1" fill={layout === key ? 'rgba(255,255,255,0.15)' : '#F0E8E0'} stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#DEC4AD'} strokeWidth="0.8"/>
                      <line x1="3" y1="4.5" x2="12" y2="4.5" stroke={layout === key ? 'rgba(255,255,255,0.5)' : '#C4A882'} strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="3" y1="7" x2="10" y2="7" stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#D4B894'} strokeWidth="1" strokeLinecap="round"/>
                      <line x1="3" y1="9.5" x2="11" y2="9.5" stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#D4B894'} strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                  )}
                  {key === 'centered' && (
                    <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                      <rect x="1" y="1" width="20" height="12" rx="1.5" fill={layout === key ? 'rgba(255,255,255,0.15)' : '#F0E8E0'} stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#DEC4AD'} strokeWidth="0.8"/>
                      <line x1="5" y1="4.5" x2="17" y2="4.5" stroke={layout === key ? 'rgba(255,255,255,0.5)' : '#C4A882'} strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="7" y1="7" x2="15" y2="7" stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#D4B894'} strokeWidth="1" strokeLinecap="round"/>
                      <line x1="6" y1="9.5" x2="16" y2="9.5" stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#D4B894'} strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                  )}
                  {key === 'split' && (
                    <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                      <rect x="1" y="1" width="20" height="12" rx="1.5" fill={layout === key ? 'rgba(255,255,255,0.15)' : '#F0E8E0'} stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#DEC4AD'} strokeWidth="0.8"/>
                      <rect x="1" y="1" width="8" height="12" rx="1.5" fill={layout === key ? 'rgba(255,255,255,0.25)' : '#D4B894'} stroke="none"/>
                      <line x1="9" y1="1" x2="9" y2="13" stroke={layout === key ? 'rgba(255,255,255,0.2)' : '#C4A882'} strokeWidth="0.8"/>
                      <line x1="11" y1="4.5" x2="19" y2="4.5" stroke={layout === key ? 'rgba(255,255,255,0.4)' : '#C4A882'} strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="11" y1="7" x2="18" y2="7" stroke={layout === key ? 'rgba(255,255,255,0.25)' : '#D4B894'} strokeWidth="1" strokeLinecap="round"/>
                      <line x1="11" y1="9.5" x2="17" y2="9.5" stroke={layout === key ? 'rgba(255,255,255,0.25)' : '#D4B894'} strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                  )}
                  {key === 'pulse' && (
                    <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                      {/* 暗背景 */}
                      <rect x="1" y="1" width="20" height="12" rx="1.5" fill={layout === key ? '#1a1a3a' : '#1C1C2E'} stroke={layout === key ? 'rgba(255,255,255,0.3)' : '#3A3A5C'} strokeWidth="0.8"/>
                      {/* QR枠（左） */}
                      <rect x="2.5" y="2.5" width="7" height="9" rx="1" fill="none" stroke={layout === key ? '#F26722' : '#6060A0'} strokeWidth="0.9"/>
                      <rect x="4" y="4" width="2" height="2" rx="0.3" fill={layout === key ? '#F26722' : '#6060A0'} opacity="0.7"/>
                      <rect x="4" y="8" width="2" height="2" rx="0.3" fill={layout === key ? '#F26722' : '#6060A0'} opacity="0.7"/>
                      <rect x="6.5" y="4" width="2" height="2" rx="0.3" fill={layout === key ? '#F26722' : '#6060A0'} opacity="0.7"/>
                      {/* 縦線 */}
                      <line x1="11" y1="2" x2="11" y2="12" stroke={layout === key ? 'rgba(242,103,34,0.5)' : 'rgba(100,100,180,0.4)'} strokeWidth="0.6"/>
                      {/* EKGライン */}
                      <path d="M 12 7 L 14 7 L 15 5.5 L 16 8.5 L 17 4.5 L 18 9.5 L 19 7 L 21 7" stroke={layout === key ? '#F26722' : '#8080C0'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
                      {/* スパイク頂点ドット */}
                      <circle cx="17" cy="4.5" r="0.9" fill={layout === key ? '#F26722' : '#8080C0'} opacity="0.9"/>
                    </svg>
                  )}
                  <span style={{ fontSize: 9 }}>{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 行4: フォント選択（7書体グリッド） + 保存ボタン */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A08068', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 36, paddingTop: 7 }}>書体</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, flex: 1 }}>
              {(Object.entries(fontMeta) as [Font, typeof fontMeta[Font]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setFont(key)} style={{
                  padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
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
                alignSelf: 'flex-start', marginTop: 1,
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
