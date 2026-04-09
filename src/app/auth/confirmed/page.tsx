'use client'

import Link from 'next/link'
import { LogoIcon } from '@/components/Logo'

export default function ConfirmedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#07060F',
        backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(123,110,245,0.2) 0%, transparent 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          background: '#0F0E20',
          borderRadius: 24,
          padding: '48px 36px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          border: '1px solid rgba(123,110,245,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* ロゴ */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <LogoIcon size={48} />
        </div>

        {/* 完了アイコン */}
        <div
          style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'rgba(52,211,153,0.1)',
            border: '2px solid rgba(52,211,153,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 0 30px rgba(52,211,153,0.2)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* メッセージ */}
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#EDEEFF', marginBottom: 8, lineHeight: 1.3 }}>
          準備ができました。
        </h1>
        <p style={{ fontSize: 14, color: '#9896C4', marginBottom: 32, lineHeight: 1.7 }}>
          あなたの分身AIを、今すぐ作りましょう。<br />
          約10分で、24時間働くAIが完成します。
        </p>

        {/* ステップ案内 */}
        <div
          style={{
            background: '#161428',
            borderRadius: 14,
            padding: '20px 16px',
            marginBottom: 28,
            textAlign: 'left',
            border: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 800, color: '#5A587E', letterSpacing: '0.1em', marginBottom: 14, textTransform: 'uppercase' }}>
            3ステップで完成
          </p>
          {[
            { num: '1', text: 'ログインしてダッシュボードへ' },
            { num: '2', text: 'AIと会話しながら、あなたの思考を学習させる（約10分）' },
            { num: '3', text: 'QRコード付きのAI名刺が完成。すぐに渡せます' },
          ].map(({ num, text }) => (
            <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6356D4, #7B6EF5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, color: 'white',
                  boxShadow: '0 2px 8px rgba(123,110,245,0.3)',
                }}
              >
                {num}
              </div>
              <p style={{ fontSize: 13, color: '#9896C4', fontWeight: 500, lineHeight: 1.5, margin: 0, paddingTop: 3 }}>
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* ログインボタン */}
        <Link
          href="/auth/login"
          style={{
            display: 'block',
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #7B6EF5, #9B8BF5)',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            borderRadius: 14,
            textDecoration: 'none',
            boxShadow: '0 8px 28px rgba(123,110,245,0.4)',
            marginBottom: 12,
          }}
        >
          分身AIを作り始める →
        </Link>

        <p style={{ fontSize: 12, color: '#5A587E' }}>
          登録したメールアドレスとパスワードでログインできます
        </p>

      </div>
    </div>
  )
}
