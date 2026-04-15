import React from 'react'

interface LogoIconProps {
  size?: number
  className?: string
}

/**
 * AI名刺 ロゴアイコン — Hermès Edition
 *
 * コンセプト: "The Living Card"
 * ─ エルメスオレンジの炎が名刺から立ち上る瞬間
 * ─ 深い琥珀のような暗背景 × ピュアオレンジのフレーム
 * ─ 上部に向かって細く伸びるダイヤモンドスパーク（炎 & 知性）
 * ─ 下部の3点が「デジタル伝達・データ」を表現
 * ─ 参照: Hermès / Bottega Veneta / Linear の精緻さ
 */
export function LogoIcon({ size = 36, className = '' }: LogoIconProps) {
  const uid = `hm-${size}`

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
        {/* ── 背景: 深い琥珀ブラック ── */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1E0900" />
          <stop offset="100%" stopColor="#080200" />
        </linearGradient>

        {/* ── エルメスオレンジ: 縦方向（メイン光沢）── */}
        <linearGradient id={`${uid}-flame`} x1="20" y1="4" x2="20" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFDFC0" />  {/* 最輝点: クリームホワイト */}
          <stop offset="20%"  stopColor="#F9A06A" />  {/* 明るいオレンジ */}
          <stop offset="50%"  stopColor="#F26722" />  {/* エルメスオレンジ */}
          <stop offset="80%"  stopColor="#C4511A" />  {/* 深みオレンジ */}
          <stop offset="100%" stopColor="#7A2800" />  {/* アンバーブラウン */}
        </linearGradient>

        {/* ── エルメスオレンジ: 横方向（クロスライト）── */}
        <linearGradient id={`${uid}-cross`} x1="10" y1="18" x2="30" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#7A2800" />
          <stop offset="40%"  stopColor="#F26722" />
          <stop offset="50%"  stopColor="#FFDFC0" />  {/* 最輝点: 中央 */}
          <stop offset="60%"  stopColor="#F26722" />
          <stop offset="100%" stopColor="#7A2800" />
        </linearGradient>

        {/* ── ドット用: オレンジグロー ── */}
        <linearGradient id={`${uid}-dots`} x1="10" y1="35" x2="28" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#C4511A" />
          <stop offset="50%"  stopColor="#F26722" />
          <stop offset="100%" stopColor="#C4511A" />
        </linearGradient>

        {/* ── 中心グロー: オレンジ放射 ── */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="45%" r="42%">
          <stop offset="0%"   stopColor="rgba(242,103,34,0.40)" />
          <stop offset="60%"  stopColor="rgba(242,103,34,0.10)" />
          <stop offset="100%" stopColor="rgba(242,103,34,0)"    />
        </radialGradient>

        {/* ── 上部ハイライト: 奥行き感 ── */}
        <radialGradient id={`${uid}-hi`} cx="40%" cy="0%" r="70%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.07)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>

        {/* ── スパーク後光: ソフトブラー ── */}
        <filter id={`${uid}-blur`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>

        {/* ── ハロー: 深いグロー ── */}
        <filter id={`${uid}-halo`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>

        {/* ── ドットグロー ── */}
        <filter id={`${uid}-dotglow`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* ── 背景 ── */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />

      {/* ── 上部奥行きハイライト ── */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-hi)`} />

      {/* ── 中心オレンジグロー ── */}
      <rect width="40" height="40" rx="10" fill={`url(#${uid}-glow)`} />

      {/*
        ── メインマーク: Hermès Flame ──
        非対称ダイヤモンド: 上向きに長く伸ばし「炎」の気配
        中心 (20, 18)
        上点 (20, 4)   ← 長め、炎のように
        下点 (20, 32)  ← やや短め
        右点 (28, 18)
        左点 (12, 18)
        コントロールポイントをタイトに絞り razor-sharp な印象に
      */}

      {/* ハロー（後光） */}
      <ellipse
        cx="20" cy="17" rx="8.5" ry="10"
        fill="rgba(242,103,34,0.22)"
        filter={`url(#${uid}-halo)`}
      />

      {/* ブラー版（グロー） */}
      <path
        d="M20,4 Q21.4,14.5 28,18 Q21.4,21.5 20,32 Q18.6,21.5 12,18 Q18.6,14.5 20,4 Z"
        fill={`url(#${uid}-flame)`}
        filter={`url(#${uid}-blur)`}
        opacity="0.45"
      />

      {/* 本体 */}
      <path
        d="M20,4 Q21.4,14.5 28,18 Q21.4,21.5 20,32 Q18.6,21.5 12,18 Q18.6,14.5 20,4 Z"
        fill={`url(#${uid}-flame)`}
      />

      {/* クロスライトオーバーレイ */}
      <path
        d="M20,4 Q21.4,14.5 28,18 Q21.4,21.5 20,32 Q18.6,21.5 12,18 Q18.6,14.5 20,4 Z"
        fill={`url(#${uid}-cross)`}
        opacity="0.28"
      />

      {/* ── 最輝点: 頂部ハイライト ── */}
      <circle cx="20" cy="9.5" r="1.8"
        fill="rgba(255,235,210,0.55)"
        filter={`url(#${uid}-blur)`}
      />

      {/* ── 中心輝点 ── */}
      <circle cx="20" cy="18" r="1.1" fill="rgba(255,228,200,0.88)" />

      {/*
        ── デジタル伝達ドット ──
        3点の円: 「…」→ AIが話し続けることを象徴
        名刺の下部にデータが流れるイメージ
      */}
      {/* ドットグロー（後光） */}
      <circle cx="13" cy="35.5" r="1.8" fill="rgba(242,103,34,0.5)" filter={`url(#${uid}-dotglow)`} />
      <circle cx="20" cy="35.5" r="1.8" fill="rgba(242,103,34,0.5)" filter={`url(#${uid}-dotglow)`} />
      <circle cx="27" cy="35.5" r="1.8" fill="rgba(242,103,34,0.5)" filter={`url(#${uid}-dotglow)`} />

      {/* ドット本体 */}
      <circle cx="13" cy="35.5" r="1.1" fill={`url(#${uid}-dots)`} />
      <circle cx="20" cy="35.5" r="1.1" fill={`url(#${uid}-dots)`} />
      <circle cx="27" cy="35.5" r="1.1" fill={`url(#${uid}-dots)`} />
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
  const textColor = variant === 'light' ? '#FFFFFF' : '#1C0F05'
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
            background: 'linear-gradient(135deg, #F26722, #F59340)',
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
            color: '#A08068',
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
