import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        background: '#07060F',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(123,110,245,0.15) 0%, transparent 100%)',
      }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Logo size={32} variant="light" />
        <Link
          href="/auth/login"
          className="text-sm font-semibold px-5 py-2 rounded-full transition"
          style={{
            color: '#EDEEFF',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
          }}
        >
          ログイン
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-10"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" style={{ boxShadow: '0 0 6px #34D399' }} />
          ベータ公開中
        </div>

        {/* Heading */}
        <h1 className="font-black mb-6 leading-tight tracking-tight" style={{ fontSize: 'clamp(40px, 7vw, 72px)' }}>
          <span style={{ color: '#EDEEFF', display: 'block' }}>眠っている間も、</span>
          <span className="text-gradient" style={{ display: 'block' }}>商談は進む。</span>
        </h1>

        {/* Subtext */}
        <p
          className="text-base max-w-lg mb-12 leading-relaxed"
          style={{ color: '#9896C4', whiteSpace: 'pre-line' }}
        >
          {`分身AIが24時間、あなたの代わりに顧客と対話する。\nAIが整理した要約つきで、本当に必要な商談だけを届ける。`}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link
            href="/auth/login"
            className="font-bold px-8 py-4 rounded-full text-base transition hover:opacity-90"
            style={{
              background: 'white',
              color: '#4F46E5',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            }}
          >
            無料で始める →
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold px-8 py-4 rounded-full text-base transition"
            style={{
              color: '#EDEEFF',
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'transparent',
            }}
          >
            ログイン
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            { step: '01', title: 'あなたを学ぶ', desc: 'AIがヒアリングを通じてあなたの思考・実績・価値観を深く学習する' },
            { step: '02', title: '代わりに話す', desc: 'QRコードから24時間。顧客の質問に、あなたらしく答え続ける' },
            { step: '03', title: '整理して届ける', desc: '会話の要約・相性評価つきで、本当に動くべき商談だけをあなたに届ける' },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="text-left p-6 rounded-2xl"
              style={{
                background: '#0F0E20',
                border: '1px solid rgba(139,92,246,0.12)',
              }}
            >
              <div
                className="text-xs font-black mb-4"
                style={{ color: '#7B6EF5' }}
              >
                {step} /
              </div>
              <h3 className="font-bold mb-2" style={{ color: '#EDEEFF' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#9896C4' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: '#5A587E' }}>
          © 2026 AI名刺
        </p>
      </div>
    </main>
  )
}
