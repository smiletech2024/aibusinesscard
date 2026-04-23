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
