import type { NextConfig } from 'next'

const securityHeaders = [
  // クリックジャッキング防止
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  // MIME スニッフィング防止
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  // リファラー漏洩を最小化
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // XSS フィルター（レガシーブラウザ向け）
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
  // Permissions Policy（不要な機能を無効化）
  {
    key:   'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // HSTS（HTTPS強制 — 1年間 + サブドメイン含む）
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Content Security Policy
  // 'unsafe-inline' は Next.js の inline script のため必要。nonce ベースに移行する場合は削除可能。
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",       // Next.js hydration に必要
      "style-src 'self' 'unsafe-inline'",                       // CSS-in-JS に必要
      "img-src 'self' data: blob: https:",                      // QR data URI + 外部画像
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.openai.com https://api.deepseek.com https://api.anthropic.com https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 全ルートにセキュリティヘッダーを適用
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
