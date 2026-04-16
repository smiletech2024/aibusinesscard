import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer style={{
      background: '#1C0F05',
      padding: '32px 20px',
      marginTop: 40,
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginBottom: 20, justifyContent: 'center' }}>
          {[
            { href: '/support',  label: 'サポート' },
            { href: '/faq',      label: 'よくある質問' },
            { href: '/feedback', label: '意見箱' },
            { href: '/tokusho',  label: '特定商取引法に基づく表記' },
            { href: '/terms',    label: '利用規約' },
            { href: '/privacy',  label: 'プライバシーポリシー' },
            { href: '/refund',   label: '返金・キャンセルポリシー' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{ fontSize: 12, color: '#A08068', textDecoration: 'none' }}
            >
              {label}
            </Link>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#6B4030', textAlign: 'center', margin: 0 }}>
          © 2026 AI名刺
        </p>
      </div>
    </footer>
  )
}
