import Link from 'next/link'
import { Logo } from '@/components/Logo'
import SiteFooter from '@/components/SiteFooter'

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        background: '#0D0600',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(242,103,34,0.22) 0%, transparent 100%)',
      }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Logo size={32} variant="light" />
        <Link
          href="/auth/login"
          className="text-sm font-semibold px-5 py-2 rounded-full transition"
          style={{
            color: '#FFF0E8',
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
          先行体験・無料公開中
        </div>

        {/* Heading */}
        <h1 className="font-black mb-6 leading-tight tracking-tight" style={{ fontSize: 'clamp(40px, 7vw, 72px)' }}>
          <span style={{ color: '#FFF0E8', display: 'block' }}>あなたの名刺が、</span>
          <span className="text-gradient" style={{ display: 'block' }}>24時間話し続ける。</span>
        </h1>

        {/* Subtext */}
        <p
          className="text-base max-w-lg mb-12 leading-relaxed"
          style={{ color: '#C49A80', whiteSpace: 'pre-line' }}
        >
          {`QRコードを渡すだけ。あなたの分身AIが顧客の相談に応え、\n本当に会うべき人だけを、整理された状態で届けてくれる。`}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link
            href="/auth/login"
            className="font-bold px-8 py-4 rounded-full text-base transition hover:opacity-90"
            style={{
              background: 'white',
              color: '#D4551A',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            }}
          >
            自分の分身AIを作る →
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold px-8 py-4 rounded-full text-base transition"
            style={{
              color: '#FFF0E8',
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'transparent',
            }}
          >
            ログイン
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-24">
          {[
            { step: '01', title: 'あなたを深く知る', desc: '約3分のヒアリング。思考・実績・価値観をAIが学習し、あなたらしい答え方を身につける。' },
            { step: '02', title: '代わりに、話す', desc: 'QRを渡せばあとは全自動。深夜でも、移動中でも、顧客の質問にあなたとして答え続ける。' },
            { step: '03', title: '要約して、届ける', desc: '相性・課題・未解決点を整理した状態で通知。本当に動くべき商談だけが手元に届く。' },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="text-left p-6 rounded-2xl"
              style={{
                background: '#1A0900',
                border: '1px solid rgba(242,103,34,0.18)',
              }}
            >
              <div className="text-xs font-black mb-4" style={{ color: '#F5843A' }}>{step} /</div>
              <h3 className="font-bold mb-2" style={{ color: '#FFF0E8' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#A08068' }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* 料金プラン（Stripe要件：ログイン不要で公開） */}
        <div className="w-full max-w-3xl mb-24">
          <h2 className="font-black text-center mb-8 text-xl" style={{ color: '#FFF0E8' }}>料金プラン</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'フリー', price: '無料', desc: '基本機能・分身AI1体' },
              { name: 'スタンダード', price: '¥480/月', desc: '名刺3枚・トークン拡張' },
              { name: 'ビジネス', price: '¥2,980/月', desc: '名刺10枚・優先サポート' },
              { name: 'エンタープライズ', price: '¥9,800/月', desc: '無制限・専任サポート' },
            ].map(({ name, price, desc }) => (
              <div
                key={name}
                className="p-4 rounded-2xl text-center"
                style={{ background: '#1A0900', border: '1px solid rgba(242,103,34,0.18)' }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: '#F5843A' }}>{name}</div>
                <div className="font-black text-lg mb-1" style={{ color: '#FFF0E8' }}>{price}</div>
                <div className="text-xs leading-snug" style={{ color: '#A08068' }}>{desc}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs mt-4" style={{ color: '#6B4030' }}>
            価格はすべて税込（JPY）。クレジットカード決済（Visa・Mastercard・AMEX・JCB）
          </p>
        </div>
      </div>

      {/* 特定商取引法リンク（Stripe要件：目立つ位置に表示） */}
      <div
        style={{
          background: '#150A00',
          borderTop: '1px solid rgba(242,103,34,0.12)',
          padding: '14px 20px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: '#6B4030', margin: '0 0 6px' }}>
          販売事業者：AI名刺（運営：スマイルテックエージェント） / 責任者：後藤鋼
        </p>
        <Link
          href="/tokusho"
          style={{
            fontSize: 12,
            color: '#F5843A',
            textDecoration: 'underline',
            fontWeight: 700,
          }}
        >
          特定商取引法に基づく表記
        </Link>
      </div>

      <SiteFooter />
    </main>
  )
}
