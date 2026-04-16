import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM          = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL      = 'https://www.aimeishi.biz'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Bad Request' }, { status: 400 })

    const admin = getAdmin()

    // Admin API でリカバリーリンク生成（Supabaseのメール送信を使わない）
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo: `${SITE_URL}/auth/confirm` },
    })

    console.log('[send-reset-email] generateLink result:', JSON.stringify({ linkData, linkError }))

    if (linkError) {
      // ユーザーが存在しない場合もセキュリティのため成功を返す
      console.log('[send-reset-email] generateLink error (possibly no user):', linkError.message)
      return NextResponse.json({ ok: true })
    }

    // action_link を使用（supabase.co のverifyエンドポイント経由で認証後 redirectTo へ）
    const actionLink = linkData?.properties?.action_link
    const hashedToken = linkData?.properties?.hashed_token

    console.log('[send-reset-email] action_link:', actionLink?.slice(0, 60))
    console.log('[send-reset-email] hashed_token:', hashedToken?.slice(0, 20))

    if (!hashedToken && !actionLink) {
      console.error('[send-reset-email] no token in response')
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
    }

    // hashed_token があれば自ドメインのconfirmページへ、なければaction_linkを直接使用
    const confirmUrl = hashedToken
      ? `${SITE_URL}/auth/confirm?token_hash=${hashedToken}&type=recovery`
      : actionLink!

    // Resend で直接送信
    const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background-color:#F26722;padding:24px 32px;text-align:center">
            <span style="font-size:24px;font-weight:900;color:#ffffff">AI名刺</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#1a1a1a">パスワードリセット</h2>
            <p style="margin:0 0 8px;color:#333333;line-height:1.8;font-size:15px">
              パスワードリセットのリクエストを受け付けました。<br>
              以下のボタンから新しいパスワードを設定してください。
            </p>
            <p style="margin:0 0 24px;color:#888888;font-size:13px">
              ※ このリンクは<strong>1時間</strong>有効です。
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${confirmUrl}"
                style="background-color:#F26722;color:#ffffff;font-weight:800;padding:16px 40px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;border:2px solid #F26722">
                パスワードを再設定する
              </a>
            </div>
            <p style="text-align:center;margin-top:12px">
              <a href="${confirmUrl}" style="color:#F26722;font-size:12px;word-break:break-all">
                リンクが開かない場合はこちら
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px">
            <hr style="border:none;border-top:1px solid #e0e0e0;margin:28px 0">
            <p style="color:#999999;font-size:11px;text-align:center;line-height:1.8">
              このメールはAI名刺から送信されています。<br>
              心当たりがない場合はこのメールを無視してください。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [email],
        subject: '【AI名刺】パスワードリセットのご案内',
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[send-reset-email] Resend error:', err)
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
    }

    console.log(`[send-reset-email] sent to ${email}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-reset-email]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
