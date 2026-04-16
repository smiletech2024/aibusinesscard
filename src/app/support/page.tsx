import LegalLayout from '@/components/LegalLayout'
import Link from 'next/link'

const Card = ({ icon, title, desc, href, linkText }: { icon: string; title: string; desc: string; href: string; linkText: string }) => (
  <a href={href} target={href.startsWith('http') || href.startsWith('mailto') ? '_blank' : undefined} rel="noopener noreferrer"
    style={{ display: 'block', background: '#fff', border: '1px solid #EDD9C8', borderRadius: 16, padding: '20px', textDecoration: 'none', transition: 'box-shadow 0.2s' }}>
    <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: '#A08068', lineHeight: 1.7, marginBottom: 12 }}>{desc}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: '#F26722' }}>{linkText} →</div>
  </a>
)

export default function SupportPage() {
  return (
    <LegalLayout title="サポート">
      <p style={{ fontSize: 13.5, color: '#4A2C1A', lineHeight: 1.8, marginBottom: 28 }}>
        AI名刺に関するご質問・お困りのことがあれば、以下よりお気軽にご連絡ください。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 40 }}>
        <Card
          icon="📧"
          title="メールサポート"
          desc="ご質問・不具合報告・ご要望など、なんでもお送りください。平日10:00〜18:00に対応します。"
          href="mailto:admin@aimeishi.biz"
          linkText="admin@aimeishi.biz"
        />
        <Card
          icon="💳"
          title="お支払い・請求"
          desc="請求内容の確認、領収書のダウンロード、支払い方法の変更はStripeポータルから行えます。"
          href="/pricing"
          linkText="プランページへ（支払い履歴ボタン）"
        />
        <Card
          icon="🔄"
          title="解約・プラン変更"
          desc="月額プランの解約・変更はいつでも可能です。解約後も契約期間終了まで利用できます。"
          href="/pricing"
          linkText="プランページへ"
        />
        <Card
          icon="🪙"
          title="トークン・残高"
          desc="トークン残高の確認・追加購入はトークン補充ページから行えます。"
          href="/credits"
          linkText="トークン補充ページへ"
        />
      </div>

      <div style={{ background: '#FAF5F0', borderRadius: 16, padding: '24px', marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', marginBottom: 16 }}>よくある質問</div>

        {[
          {
            q: 'AIが反応しません',
            a: 'トークン残高が0になっている可能性があります。ダッシュボードでトークン残高を確認し、必要であればトークンパックをご購入ください。'
          },
          {
            q: '決済ページが開きません',
            a: 'ブラウザのポップアップブロックが原因の場合があります。ブラウザ設定でaimeishi.bizのポップアップを許可してください。'
          },
          {
            q: 'プランを変更したのに反映されません',
            a: '決済完了後、数分以内に反映されます。画面を再読み込みしてもが反映されない場合は admin@aimeishi.biz までご連絡ください。'
          },
          {
            q: 'QRコードをスキャンしてもAIが答えてくれません',
            a: 'トークン残高の確認のほか、ペルソナ設定が完了しているかもご確認ください。設定が不完全な場合はAIが正しく動作しないことがあります。'
          },
          {
            q: 'アカウントを削除したい',
            a: '現在、アカウント削除はサポートへのメールにて承っています。admin@aimeishi.biz へ「アカウント削除希望」とメールください。'
          },
        ].map(({ q, a }) => (
          <div key={q} style={{ borderBottom: '1px solid #EDD9C8', padding: '14px 0' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1C0F05', marginBottom: 6 }}>Q. {q}</div>
            <div style={{ fontSize: 13, color: '#4A2C1A', lineHeight: 1.7 }}>A. {a}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(135deg,#C4511A,#F26722)', borderRadius: 16, padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>上記で解決しない場合</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
          お気軽にメールでお問い合わせください。丁寧に対応いたします。
        </div>
        <a href="mailto:admin@aimeishi.biz"
          style={{ display: 'inline-block', background: '#fff', color: '#F26722', fontWeight: 800, fontSize: 14, padding: '10px 28px', borderRadius: 99, textDecoration: 'none' }}>
          📧 メールで問い合わせる
        </a>
      </div>
    </LegalLayout>
  )
}
