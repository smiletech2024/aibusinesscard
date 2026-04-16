import LegalLayout from '@/components/LegalLayout'

const S = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1C0F05', margin: '28px 0 10px', paddingBottom: 6, borderBottom: '2px solid #EDD9C8' }}>{children}</h2>
)
const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 1.9, margin: '8px 0' }}>{children}</p>
)

export default function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <P>
        AI名刺（以下「当サービス」）は、ユーザーの個人情報の保護を重要な責務と考え、
        個人情報の保護に関する法律（個人情報保護法）を遵守し、以下のとおり取り扱います。
      </P>

      <S>1. 収集する情報</S>
      <P>当サービスでは、以下の情報を収集します：</P>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li>メールアドレス（アカウント登録時）</li>
        <li>氏名・プロフィール情報（任意入力）</li>
        <li>名刺情報・ペルソナ設定（ユーザーが入力した情報）</li>
        <li>AIとの会話ログ（サービス改善・品質向上のため）</li>
        <li>決済情報（クレジットカード情報はStripe社が管理し、当社は保持しません）</li>
        <li>アクセスログ・利用状況データ</li>
      </ul>

      <S>2. 利用目的</S>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li>サービスの提供・運営・改善</li>
        <li>ユーザーへのサポート対応</li>
        <li>サービスに関するお知らせの送信</li>
        <li>不正利用の防止・セキュリティ確保</li>
        <li>利用規約違反への対応</li>
      </ul>

      <S>3. 第三者提供</S>
      <P>
        当社は、以下の場合を除き、個人情報を第三者に提供しません：
      </P>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li>ユーザーの同意がある場合</li>
        <li>法令に基づく開示が必要な場合</li>
        <li>人の生命・身体・財産の保護に必要な場合</li>
      </ul>

      <S>4. 外部サービスの利用</S>
      <P>当サービスは以下の外部サービスを利用しています：</P>
      <ul style={{ fontSize: 13.5, color: '#1C0F05', lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
        <li><strong>Supabase</strong>（認証・データベース）</li>
        <li><strong>Stripe</strong>（決済処理）</li>
        <li><strong>DeepSeek API / Anthropic API</strong>（AI生成）</li>
        <li><strong>Vercel</strong>（ホスティング）</li>
      </ul>
      <P>各サービスのプライバシーポリシーについては各社のウェブサイトをご参照ください。</P>

      <S>5. Cookie・アクセス解析</S>
      <P>
        当サービスでは、セッション管理のためCookieを使用しています。
        ブラウザの設定によりCookieを無効にすることができますが、一部機能が使用できなくなる場合があります。
      </P>

      <S>6. 個人情報の管理</S>
      <P>
        収集した個人情報は、不正アクセス・紛失・漏洩・改ざんを防ぐため、適切なセキュリティ対策を講じます。
        データはSupabase（AWS infrastructure）上に暗号化して保存されます。
      </P>

      <S>7. 開示・訂正・削除</S>
      <P>
        ユーザーは自身の個人情報の開示・訂正・削除を求めることができます。
        ご希望の方は admin@aimeishi.biz までご連絡ください。本人確認の上、合理的な期間内に対応します。
      </P>

      <S>8. 未成年者の利用</S>
      <P>
        18歳未満の方が当サービスを利用する場合は、保護者の同意を得た上でご利用ください。
      </P>

      <S>9. プライバシーポリシーの変更</S>
      <P>
        本ポリシーは、法令改正やサービス変更に応じて改定することがあります。
        重要な変更がある場合はサービス内でお知らせします。
      </P>

      <S>10. お問い合わせ</S>
      <P>個人情報に関するお問い合わせは以下までご連絡ください：</P>
      <P>メール：admin@aimeishi.biz</P>

      <p style={{ marginTop: 32, fontSize: 12, color: '#A08068' }}>最終更新日：2026年4月</p>
    </LegalLayout>
  )
}
