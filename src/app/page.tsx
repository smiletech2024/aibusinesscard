import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #3730A3 0%, #5B21B6 50%, #6D28D9 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Logo size={32} variant="light" />
        <Link
          href="/auth/login"
          className="text-sm font-semibold px-4 py-2 rounded-full transition hover:bg-white/20"
          style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          ログイン
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
          style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.25)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          新しい営業のかたち
        </div>

        {/* Heading */}
        <h1
          className="text-4xl sm:text-5xl font-black mb-6 leading-tight tracking-tight"
          style={{ color: '#FFFFFF' }}
        >
          渡した相手が、いつでも
          <br />
          <span style={{ color: '#C4B5FD' }}>あなたの分身AI</span>と話せる名刺
        </h1>

        {/* Subtext */}
        <p
          className="text-base max-w-xl mb-12 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.62)' }}
        >
          あなたの分身AIが24時間、顧客の相談を受け付け、
          <br className="hidden sm:block" />
          会話を整理して本人に橋渡し。次世代名刺がここに。
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link
            href="/auth/login"
            className="font-bold px-8 py-4 rounded-full text-base transition hover:opacity-90"
            style={{
              background: 'white',
              color: '#4F46E5',
              boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            }}
          >
            無料で始める →
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold px-8 py-4 rounded-full text-base transition hover:bg-white/10"
            style={{
              color: 'white',
              border: '2px solid rgba(255,255,255,0.35)',
            }}
          >
            ログイン
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            { step: '01', title: '分身AI作成', desc: 'ヒアリングAIがあなたの思考・実績・スタイルを学習します' },
            { step: '02', title: '顧客が相談', desc: 'QRコードから24時間いつでも分身AIと深く対話できます' },
            { step: '03', title: '本会話へ', desc: 'AIが整理した要約付きで、最高の状態でクロージングへ' },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="text-left p-5 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                className="text-xs font-black mb-3"
                style={{ color: '#A5B4FC' }}
              >
                {step}
              </div>
              <h3 className="font-bold text-white mb-1.5">{title}</h3>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          © 2026 AI名刺
        </p>
      </div>
    </main>
  )
}
