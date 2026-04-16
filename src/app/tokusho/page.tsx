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
        特定商取引法第11条（通信販売についての広告）に基づき、以下の事項を表示します。
      </p>

      <S>販売業者情報</S>
      <Row label="販売事業者名" value="スマイルテックエージェント" />
      <Row label="運営統括責任者" value="後藤鋼" />
      <Row label="所在地" value="兵庫県加古川市平岡町新在家716-8 ハイタウンD-412" />
      <Row label="電話番号"
        value={
          <>
            079-457-9873<br />
            <span style={{ fontSize: 12, color: '#A08068' }}>
              受付時間：平日 10:00〜18:00（土日祝・年末年始を除く）<br />
              ※お問い合わせはメールにてお願いします
            </span>
          </>
        }
      />
      <Row label="メールアドレス" value="admin@aimeishi.biz" />
      <Row label="販売URL" value="https://www.aimeishi.biz" />

      <S>商品・サービスについて</S>
      <Row label="サービス名" value="AI名刺（aimeishi.biz）" />
      <Row
        label="サービスの内容"
        value="AIを活用したデジタル名刺・分身AIペルソナ管理サービス。QRコードを通じてお客様がAIと対話し、名刺交換後の関係構築を支援します。月額サブスクリプションおよびトークンチャージによる従量課金制。"
      />
      <Row label="動作環境" value="インターネット接続環境、モダンブラウザ（Chrome・Safari・Firefox・Edge 最新版）" />

      <S>料金・支払いについて</S>
      <Row
        label="販売価格（税込）"
        value={
          <>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>■ 月額プラン（継続課金）</div>
            フリープラン：無料<br />
            スタンダードプラン：¥480 / 月（税込）<br />
            ビジネスプラン：¥2,980 / 月（税込）<br />
            エンタープライズプラン：¥9,800 / 月（税込）<br />
            <br />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>■ トークンパック（都度課金）</div>
            Sパック：¥500（税込）<br />
            Mパック：¥1,000（税込）<br />
            Lパック：¥2,500（税込）<br />
            LLパック：¥5,000（税込）<br />
            <br />
            <span style={{ fontSize: 12, color: '#A08068' }}>
              ※ 価格はすべて日本円（JPY）・消費税10%込みの表示です。
            </span>
          </>
        }
      />
      <Row label="支払方法" value="クレジットカード（Visa・Mastercard・American Express・JCB）" />
      <Row
        label="支払時期"
        value={
          <>
            月額プラン：ご契約日から毎月同日に自動引き落とし（継続課金）<br />
            トークンパック：ご購入時に即時決済<br />
            <span style={{ fontSize: 12, color: '#A08068' }}>
              ※ 月額プランは解約手続きをされるまで毎月自動的に更新・決済されます。
            </span>
          </>
        }
      />
      <Row label="決済代行業者" value="Stripe, Inc.（PCI DSS Level 1準拠）" />

      <S>継続課金（サブスクリプション）に関する重要事項</S>
      <Row
        label="自動更新について"
        value={
          <span style={{ color: '#C0392B', fontWeight: 600 }}>
            月額プランは毎月自動的に更新されます。解約しない限り、毎月同額が請求され続けます。
          </span>
        }
      />
      <Row
        label="解約方法"
        value={
          <>
            ダッシュボード右上のメニュー →「プラン・支払い」→「解約する」から、いつでも解約できます。<br />
            または admin@aimeishi.biz へご連絡ください。<br />
            <span style={{ fontSize: 12, color: '#A08068' }}>
              ※ 解約後も当月契約期間終了日まで引き続きご利用いただけます。
            </span>
          </>
        }
      />
      <Row label="無料トライアル" value="現在、無料トライアル期間は設けておりません。フリープランにて無期限でお試しいただけます。" />

      <S>サービス提供について</S>
      <Row label="提供時期" value="決済完了後、即時ご利用可能です。" />
      <Row
        label="提供方法"
        value="インターネット経由でのオンラインサービス提供。物品の発送はありません。"
      />

      <S>キャンセル・返金について</S>
      <Row
        label="月額プランの解約"
        value={
          <>
            いつでも解約可能です。解約後も契約期間終了日まで引き続きご利用いただけます。<br />
            <strong>日割り・月割りでの返金はお受けしておりません。</strong>
          </>
        }
      />
      <Row
        label="トークンパックの返金"
        value={
          <>
            デジタルコンテンツの性質上、購入完了後の返金はお受けしておりません。<br />
            ただし、未使用トークンはアカウント有効期間中いつでもご利用いただけます。
          </>
        }
      />
      <Row
        label="返金対応（例外）"
        value={
          <>
            当社側のシステム障害・不具合に起因する場合は、個別に返金対応いたします。<br />
            admin@aimeishi.biz までご連絡ください。
          </>
        }
      />

      <S>その他</S>
      <Row
        label="未成年者のご利用"
        value="未成年者がご利用になる場合は、保護者の同意を得た上でご利用ください。"
      />
      <Row
        label="禁止事項"
        value="利用規約に定める禁止行為（スパム・なりすまし・不正利用等）が確認された場合、アカウントを停止し、返金はいたしません。"
      />
      <Row
        label="準拠法・管轄裁判所"
        value="本サービスに関する紛争は、日本法に準拠し、神戸地方裁判所を第一審の専属的合意管轄裁判所とします。"
      />

      <p style={{ marginTop: 32, fontSize: 12, color: '#A08068' }}>最終更新日：2026年4月</p>
    </LegalLayout>
  )
}
