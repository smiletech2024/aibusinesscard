import LegalLayout from '@/components/LegalLayout'

const S = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', margin: '28px 0 10px', paddingBottom: 6, borderBottom: '2px solid #EDD9C8' }}>{children}</h2>
)
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #F5E8DC', fontSize: 13.5, lineHeight: 1.7 }}>
    <div style={{ width: 160, flexShrink: 0, color: '#A08068', fontWeight: 600 }}>{label}</div>
    <div style={{ color: '#1C0F05' }}>{value}</div>
  </div>
)

export default function TokushoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表記">
      <p style={{ fontSize: 13, color: '#A08068', marginBottom: 24 }}>
        特定商取引法第11条に基づき、以下の事項を表示します。
      </p>

      <Row label="販売事業者名" value="【事業者名・屋号を記入】" />
      <Row label="運営統括責任者" value="【代表者氏名を記入】" />
      <Row label="所在地" value="【住所を記入】" />
      <Row label="電話番号"
        value={<>【電話番号を記入】<br /><span style={{ fontSize: 12, color: '#A08068' }}>※お問い合わせはメールにてお願いします</span></>}
      />
      <Row label="メールアドレス" value="admin@aimeishi.biz" />
      <Row label="販売URL" value="https://www.aimeishi.biz" />
      <Row label="サービス名" value="AI名刺（aimeishi.biz）" />
      <Row label="サービスの内容"
        value="AIを活用した名刺・ペルソナ管理サービス。月額サブスクリプションおよびトークンチャージによる従量課金制。"
      />

      <S>料金・支払いについて</S>
      <Row label="料金" value={<>フリー：無料<br />スタンダード：¥480/月<br />ビジネス：¥2,980/月<br />エンタープライズ：¥9,800/月<br />トークンパック（S〜LL）：¥500〜¥5,000（一回払い）</>} />
      <Row label="支払方法" value="クレジットカード（Visa・Mastercard・American Express・JCB）" />
      <Row label="支払時期" value={<>月額プラン：契約日から毎月同日に自動引き落とし<br />トークンパック：購入時に即時決済</>} />
      <Row label="決済代行" value="Stripe, Inc.（PCI DSS準拠）" />

      <S>サービス提供について</S>
      <Row label="提供時期" value="決済完了後、即時利用可能" />
      <Row label="動作環境" value="インターネット接続環境、モダンブラウザ（Chrome・Safari・Firefox・Edge 最新版）" />

      <S>キャンセル・返金について</S>
      <Row label="月額プラン解約"
        value="いつでも解約可能。解約後も契約期間終了日まで利用でき、日割り返金はありません。"
      />
      <Row label="トークンパック"
        value="デジタルコンテンツの性質上、購入完了後の返金はお断りしています。ただし未使用トークンはアカウント有効期間中いつでも使用できます。"
      />
      <Row label="返金対応" value="システム障害等、当社起因の場合は個別対応いたします。admin@aimeishi.biz までご連絡ください。" />

      <p style={{ marginTop: 32, fontSize: 12, color: '#A08068' }}>最終更新日：2026年4月</p>
    </LegalLayout>
  )
}
