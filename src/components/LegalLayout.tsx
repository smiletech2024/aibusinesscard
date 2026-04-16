import Link from 'next/link'

type Props = {
  title: string
  children: React.ReactNode
}

export default function LegalLayout({ title, children }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5F0' }}>
      {/* ヘッダー */}
      <div style={{ background: 'linear-gradient(135deg,#C4511A,#F26722)', padding: '20px 20px 32px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            ← トップへ戻る
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>{title}</h1>
        </div>
      </div>

      {/* 本文 */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        {children}
      </div>
    </div>
  )
}
