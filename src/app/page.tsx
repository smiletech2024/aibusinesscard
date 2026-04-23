import Link from 'next/link'
import { Logo } from '@/components/Logo'
import SiteFooter from '@/components/SiteFooter'

/* ─────────────────────────────────────────────
   Hermès Orange × Leather — カラーパレット
   hermes   : #E8601C  (Pantone 1665C 相当・本家エルメスオレンジ)
   cream    : #FBF4EC  (ナチュラルレザー地)
   parchment: #F0E4D0  (少し深いクリーム)
   saddle   : #C4883A  (サドルブラウン・ゴールド系)
   deepBrown: #2C1806  (最暗・文字)
   midBrown : #7A4A28  (中間)
   lightBrown:#B88860  (薄め)
───────────────────────────────────────────── */

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        /* レザー地：温かみのあるクリームベース＋微細グレイン */
        background: '#FBF4EC',
        backgroundImage: `
          url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C4883A' fill-opacity='0.045'%3E%3Cpath d='M0 0h40v40H0zm40 40h40v40H40z'/%3E%3C/g%3E%3C/svg%3E"),
          radial-gradient(ellipse 90% 55% at 50% -10%, rgba(232,96,28,0.13) 0%, transparent 70%)
        `,
      }}
    >
      {/* ─── Nav ─── */}
      <nav
        className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full"
        style={{ borderBottom: '1px solid rgba(196,136,58,0.15)' }}
      >
        <Logo size={32} variant="dark" />
        <Link
          href="/auth/login"
          className="text-sm font-semibold px-5 py-2 rounded-full transition hover:opacity-80"
          style={{
            color: '#E8601C',
            border: '1.5px solid #E8601C',
            background: 'transparent',
          }}
        >
          ログイン
        </Link>
      </nav>

      {/* ─── Hero ─── */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-10"
          style={{
            background: 'rgba(232,96,28,0.09)',
            color: '#C4511A',
            border: '1px solid rgba(232,96,28,0.3)',
            letterSpacing: '0.05em',
          }}
        >
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: '#E8601C', boxShadow: '0 0 6px #E8601C' }}
          />
          先行体験・無料公開中
        </div>

        {/* Heading */}
        <h1
          className="font-black mb-6 leading-tight tracking-tight"
          style={{ fontSize: 'clamp(38px, 7vw, 68px)' }}
        >
          <span style={{ color: '#2C1806', display: 'block' }}>あなたの名刺が、</span>
          <span
            style={{
              display: 'block',
              background: 'linear-gradient(120deg, #E8601C 0%, #F5903A 60%, #C4883A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            24時間話し続ける。
          </span>
        </h1>

        {/* Subtext */}
        <p
          className="text-base max-w-lg mb-12 leading-relaxed"
          style={{ color: '#7A4A28', whiteSpace: 'pre-line' }}
        >
          {`QRコードを渡すだけ。あなたの分身AIが顧客の相談に応え、\n本当に会うべき人だけを、整理された状態で届けてくれる。`}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link
            href="/auth/login"
            className="font-bold px-8 py-4 rounded-full text-base transition hover:opacity-90"
            style={{
              background: '#E8601C',
              color: 'white',
              boxShadow: '0 6px 28px rgba(232,96,28,0.38)',
              letterSpacing: '0.02em',
            }}
          >
            自分の分身AIを作る →
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold px-8 py-4 rounded-full text-base transition hover:bg-orange-50"
            style={{
              color: '#2C1806',
              border: '1.5px solid rgba(196,136,58,0.5)',
              background: 'rgba(255,255,255,0.6)',
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
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(196,136,58,0.25)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 16px rgba(196,136,58,0.1)',
              }}
            >
              {/* ステッチライン風アクセント */}
              <div
                style={{
                  width: 32, height: 3, borderRadius: 2,
                  background: 'linear-gradient(90deg,#E8601C,#C4883A)',
                  marginBottom: 16,
                }}
              />
              <div className="text-xs font-black mb-2" style={{ color: '#E8601C', letterSpacing: '0.1em' }}>
                {step} /
              </div>
              <h3 className="font-bold mb-2" style={{ color: '#2C1806' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#7A4A28' }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* 料金プラン */}
        <div className="w-full max-w-3xl mb-24">
          <h2
            className="font-black text-center mb-2 text-xl"
            style={{ color: '#2C1806' }}
          >
            料金プラン
          </h2>
          <p className="text-center text-sm mb-8" style={{ color: '#B88860' }}>
            まずは無料でお試しください
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'フリー',         price: '無料',     desc: '基本機能・分身AI1体' },
              { name: 'スタンダード',   price: '¥480/月',  desc: '名刺3枚・トークン拡張' },
              { name: 'ビジネス',       price: '¥2,980/月',desc: '名刺10枚・優先サポート' },
              { name: 'エンタープライズ',price: '¥9,800/月',desc: '無制限・専任サポート' },
            ].map(({ name, price, desc }, i) => (
              <div
                key={name}
                className="p-4 rounded-2xl text-center"
                style={{
                  background: i === 1
                    ? 'linear-gradient(145deg,#E8601C,#C4511A)'
                    : 'rgba(255,255,255,0.75)',
                  border: i === 1
                    ? 'none'
                    : '1px solid rgba(196,136,58,0.25)',
                  boxShadow: i === 1
                    ? '0 6px 24px rgba(232,96,28,0.3)'
                    : '0 2px 8px rgba(196,136,58,0.08)',
                }}
              >
                <div
                  className="text-xs font-bold mb-1"
                  style={{ color: i === 1 ? 'rgba(255,255,255,0.85)' : '#E8601C' }}
                >
                  {name}
                </div>
                <div
                  className="font-black text-lg mb-1"
                  style={{ color: i === 1 ? 'white' : '#2C1806' }}
                >
                  {price}
                </div>
                <div
                  className="text-xs leading-snug"
                  style={{ color: i === 1 ? 'rgba(255,255,255,0.75)' : '#B88860' }}
                >
                  {desc}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs mt-4" style={{ color: '#B88860' }}>
            価格はすべて税込（JPY）。クレジットカード決済（Visa・Mastercard・AMEX・JCB）
          </p>
        </div>
      </div>

      {/* ─── 特定商取引法 ─── */}
      <div
        style={{
          background: '#F0E4D0',
          borderTop: '1px solid rgba(196,136,58,0.2)',
          padding: '14px 20px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: '#B88860', margin: '0 0 6px' }}>
          販売事業者：AI名刺（運営：スマイルテックエージェント） / 責任者：後藤鋼
        </p>
        <Link
          href="/tokusho"
          style={{
            fontSize: 12,
            color: '#E8601C',
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
