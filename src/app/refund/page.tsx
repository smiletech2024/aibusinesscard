import LegalLayout from '@/components/LegalLayout'

const S = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', margin: '28px 0 10px', paddingBottom: 6, borderBottom: '2px solid #EDD9C8' }}>{children}</h2>
)
const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 1.9, margin: '8px 0' }}>{children}</p>
)
const Box = ({ color, border, children }: { color: string; border: string; children: React.ReactNode }) => (
  <div style={{ background: color, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px', margin: '12px 0', fontSize: 13.5, color: '#1C0F05', lineHeight: 1.8 }}>
    {children}
  </div>
)

export default function RefundPage() {
  return (
    <LegalLayout title="返金・キャンセルポリシー">
      <P>
        AI名刺では、デジタルサービスの性質上、原則として返金をお断りしています。
        ただし、当社起因の問題が発生した場合は誠実に対応いたします。
      </P>

      <S>月額サブスクリプションのキャンセル</S>
      <Box color="#F0FDF4" border="#86EFAC">
        <strong>✅ キャンセルはいつでも無料でできます</strong><br />
        プランページの「月額プランを解約する」から手続きできます。
      </Box>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li>キャンセル後も<strong>契約期間の終了日まで</strong>引き続き利用できます</li>
        <li>契約期間終了後は自動的にフリープランに移行します</li>
        <li>月の途中でキャンセルしても、その月の残り分の<strong>日割り返金はありません</strong></li>
        <li>次回請求日より前にキャンセルすれば、次月分は請求されません</li>
      </ul>

      <S>トークンパック（一回払い）の返金</S>
      <Box color="#FEF2F2" border="#FECACA">
        <strong>❌ 原則として返金不可</strong><br />
        デジタルコンテンツの性質上、購入完了後の返金はお断りしています。
      </Box>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li>購入したトークンに<strong>有効期限はありません</strong>（アカウント有効期間中はいつでも使用可能）</li>
        <li>未使用のトークンは翌月以降も繰り越されます</li>
        <li>誤購入の場合は購入から24時間以内に admin@aimeishi.biz へご連絡ください（個別対応）</li>
      </ul>

      <S>返金が認められる場合</S>
      <P>以下の場合は返金対応を行います：</P>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li>当社のシステム障害により、購入したトークンが付与されなかった場合</li>
        <li>同一内容の二重請求が発生した場合</li>
        <li>当社の明らかな誤りによる請求が発生した場合</li>
      </ul>
      <P>
        上記に該当すると思われる場合は、admin@aimeishi.biz までご連絡ください。
        確認の上、7営業日以内にご返答いたします。
      </P>

      <S>プラン変更時の取り扱い</S>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li><strong>アップグレード</strong>：即時反映。残存期間の差額調整はStripeが自動計算します</li>
        <li><strong>ダウングレード</strong>：現在の契約期間終了後に適用されます</li>
      </ul>

      <S>お問い合わせ</S>
      <P>
        返金・キャンセルに関するご相談は以下までお気軽にどうぞ：<br />
        📧 admin@aimeishi.biz<br />
        対応時間：平日10:00〜18:00（土日祝除く）
      </P>

      <p style={{ marginTop: 32, fontSize: 12, color: '#A08068' }}>最終更新日：2026年4月</p>
    </LegalLayout>
  )
}
