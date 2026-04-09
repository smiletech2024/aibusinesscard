'use client'

import Link from 'next/link'
import { LogoIcon } from '@/components/Logo'

export default function ConfirmedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #3730A3 0%, #5B21B6 50%, #6D28D9 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 24,
          padding: '48px 36px',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
      >
        {/* ロゴ */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <LogoIcon size={56} />
        </div>

        {/* 完了アイコン */}
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 28,
          }}
        >
          ✓
        </div>

        {/* メッセージ */}
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1E1B4B', marginBottom: 8, lineHeight: 1.3 }}>
          メール認証が完了しました！
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 32, lineHeight: 1.7 }}>
          AI名刺へようこそ。<br />
          さっそくあなたの分身AI名刺を作りましょう。
        </p>

        {/* ステップ案内 */}
        <div
          style={{
            background: '#F4F3FA',
            borderRadius: 14,
            padding: '20px 16px',
            marginBottom: 28,
            textAlign: 'left',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 800, color: '#9896B8', letterSpacing: '0.1em', marginBottom: 12 }}>
            これからの流れ
          </p>
          {[
            { num: '1', text: 'ログインしてダッシュボードへ' },
            { num: '2', text: 'AIとの会話であなたの情報を登録（約5分）' },
            { num: '3', text: 'QRコード付き名刺が完成！共有・印刷できます' },
          ].map(({ num, text }) => (
            <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, color: 'white',
                }}
              >
                {num}
              </div>
              <p style={{ fontSize: 13, color: '#4A4870', fontWeight: 600, lineHeight: 1.5, margin: 0, paddingTop: 2 }}>
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
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            borderRadius: 12,
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            marginBottom: 12,
          }}
        >
          ログインして始める →
        </Link>

        <p style={{ fontSize: 12, color: '#9896B8' }}>
          登録したメールアドレスとパスワードでログインできます
        </p>
      </div>
    </div>
  )
}
