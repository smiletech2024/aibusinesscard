import React from 'react'

interface LogoIconProps {
  size?: number
  className?: string
}

/**
 * AI名刺 ロゴアイコン — Luxury Edition
 *
 * コンセプト: "Precious Intelligence"
 * ─ 深夜の宝石箱を開けた瞬間の輝き
 * ─ ディープネイビー背景 × ゴールドの4点ダイヤモンドスパーク
 * ─ 極限まで細く絞った腕先で「精密さ・希少性」を表現
 * ─ 名刺の2本ラインをゴールドで抽象化
 * ─ 参照: Cartier / Rolex / Linear の精緻さ
 */
export function LogoIcon({ size = 36, className = '' }: LogoIconProps) {
  const uid = `lx-${size}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AI名刺"
    >
      <defs>
        {/* ── 背景: 深夜ネイビー ── */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1A1830" />
          <stop offset="100%" stopColor="#0C0B1C" />
        </linearGradient>

        {/* ── ゴールド: リアルな金属光沢 ── */}
        <linearGradient id={`${uid}-gold`} x1="20" y1="7" x2="20" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#F9EDB0" />   {/* 明るいシャンパンゴールド */}
          <stop offset="35%"  stopColor="#E8C84A" />   {/* 純金 */}
          <stop offset="65%"  stopColor="#C8960C" />   {/* 深みのあるゴールド */}
          <stop offset="100%" stopColor="#A07008" />   {/* アンバーゴールド */}
        </linearGradient>

        {/* ── ゴールド（横方向）: 左右のハイライト用 ── */}
        <linearGradient id={`${uid}-goldH`} x1="11" y1="19" x2="29" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#C8960C" />
          <stop offset="50%"  stopColor="#F9EDB0" />
          <stop offset="100%" stopColor="#C8960C" />
        </linearGradient>

        {/* ── 中心ゴールドグロー ── */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="48%" r="40%">
          <stop offset="0%"   stopColor="rgba(248,210,80,0.22)" />
          <stop offset="100%" stopColor="rgba(248,210,80,0)"    />
        </radialGradient>

        {/* ── 上部内側ハイライト ── */}
        <radialGradient id={`${uid}-hi`} cx="50%" cy="0%" r="65%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>

        {/* ── スパーク用ぼかし（後光） ── */}
        <filter id={`${uid}-blur`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.8" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <filter id={`${uid}-halo`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* ── 背景 ── */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />

      {/* ── 上部ハイライト（奥行き感） ── */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-hi)`} />

      {/* ── ゴールドハロー（スパーク後光）── */}
      <ellipse cx="20" cy="19" rx="8" ry="8" fill="rgba(240,180,40,0.18)" filter={`url(#${uid}-halo)`} />

      {/* ── ゴールドグロー ── */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-glow)`} />

      {/*
        ── 4点ダイヤモンドスパーク（メインマーク）──
        Quadratic Bézier による極細腕先
        中心 (20, 19)
        上点 (20, 7)  下点 (20, 31)
        右点 (29, 19) 左点 (11, 19)
        制御点を中心近くに絞ることで razor-sharp な腕先を実現
      */}
      {/* ハロー（ぼかし版：後光効果） */}
      <path
        d="M20,7 Q21.6,17 29,19 Q21.6,21 20,31 Q18.4,21 11,19 Q18.4,17 20,7 Z"
        fill={`url(#${uid}-gold)`}
        filter={`url(#${uid}-blur)`}
        opacity="0.5"
      />
      {/* 本体 */}
      <path
        d="M20,7 Q21.6,17 29,19 Q21.6,21 20,31 Q18.4,21 11,19 Q18.4,17 20,7 Z"
        fill={`url(#${uid}-gold)`}
      />
      {/* 横方向ゴールドオーバーレイ（十字の光沢） */}
      <path
        d="M20,7 Q21.6,17 29,19 Q21.6,21 20,31 Q18.4,21 11,19 Q18.4,17 20,7 Z"
        fill={`url(#${uid}-goldH)`}
        opacity="0.35"
      />

      {/* ── 中心の輝点 ── */}
      <circle cx="20" cy="19" r="1.4" fill="rgba(255,248,220,0.9)" />

      {/* ── 名刺ライン（ゴールド）── */}
      <rect x="7" y="34" width="15" height="1.4" rx="0.7" fill={`url(#${uid}-goldH)`} opacity="0.65" />
      <rect x="7" y="36.5" width="9.5" height="1.2" rx="0.6" fill={`url(#${uid}-goldH)`} opacity="0.38" />
    </svg>
  )
}


interface LogoProps {
  size?: number
  variant?: 'light' | 'dark'
  showText?: boolean
  className?: string
}

/** ロゴアイコン + ワードマーク "AI名刺" */
export function Logo({ size = 32, variant = 'dark', showText = true, className = '' }: LogoProps) {
  const textColor = variant === 'light' ? '#FFFFFF' : '#1E1B4B'
  const fontSize  = Math.round(size * 0.47)

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28) }}
    >
      <LogoIcon size={size} />
      {showText && (
        <span
          style={{
            fontSize,
            fontWeight: 900,
            color: textColor,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontFamily: "'Helvetica Neue', 'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif",
          }}
        >
          AI名刺
        </span>
      )}
    </div>
  )
}

/** フルサイズのロゴ（ランディングページ等） */
export function LogoBrand({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
    >
      <LogoIcon size={80} />
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            background: 'linear-gradient(135deg, #4338CA, #7C3AED)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontFamily: "'Helvetica Neue', 'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif",
          }}
        >
          AI名刺
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#9896B8',
            fontWeight: 600,
            letterSpacing: '0.12em',
            marginTop: 6,
          }}
        >
          次世代名刺
        </div>
      </div>
    </div>
  )
}
