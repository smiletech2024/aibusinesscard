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
    const { email, password, referredBy } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    const admin = getAdmin()

    // Admin API で確認リンクを生成（クライアント側レート制限を回避）
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: referredBy ? { data: { referred_by: referredBy } } : undefined,
    })

    if (error) {
      // すでに登録済みの場合
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return NextResponse.json({ error: 'already_registered' }, { status: 409 })
      }
      console.error('[signup]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // 確認URLを自ドメインに変換
    // hashed_token が正しい値（action_link の ?token= ではなく hashed_token を使う）
    const actionLink = data.properties?.action_link ?? ''
    const token_hash =
      data.properties?.hashed_token ||
      new URL(actionLink).searchParams.get('token_hash') ||
      new URL(actionLink).searchParams.get('token') ||
      ''
    const confirmUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=signup`

    // Resend でメール送信（Supabaseのメール送信レート制限を完全バイパス）
    const html = buildSignupEmail(confirmUrl)
    const res  = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [email],
        subject: '【AI名刺】メールアドレスを確認してください',
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[signup] Resend error:', err)
      return NextResponse.json({ error: 'mail_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[signup]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function buildSignupEmail(confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background-color:#F26722;padding:24px 32px;text-align:center">
            <span style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:0.02em">AI名刺</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#1a1a1a">ご登録ありがとうございます！</h2>
            <p style="margin:0 0 8px;color:#333333;line-height:1.8;font-size:15px">
              AI名刺へようこそ！🎉<br>
              以下のボタンをクリックしてメールアドレスの確認を完了してください。
            </p>
            <p style="margin:0 0 24px;color:#888888;font-size:13px">
              ※ このリンクは<strong>24時間</strong>有効です。
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${confirmUrl}"
                style="background-color:#F26722;color:#ffffff;font-weight:800;padding:16px 40px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;border:2px solid #F26722">
                メールアドレスを確認する
              </a>
            </div>
            <p style="text-align:center;margin-top:12px">
              <a href="${confirmUrl}" style="color:#F26722;font-size:12px;word-break:break-all">
                リンクが開かない場合はこちらをクリック
              </a>
            </p>
            <p style="margin:24px 0 0;color:#888888;font-size:13px;line-height:1.7;background:#fff8f5;border-left:3px solid #F26722;padding:12px 16px;border-radius:4px">
              確認完了後、無料でAI分身の作成を始められます。<br>
              初回登録ボーナスとして<strong style="color:#F26722">約100回分のAI会話</strong>をプレゼントします。
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px">
            <hr style="border:none;border-top:1px solid #e0e0e0;margin:28px 0">
            <p style="color:#999999;font-size:11px;text-align:center;line-height:1.8">
              このメールはAI名刺（<a href="${SITE_URL}" style="color:#F26722;text-decoration:none">aimeishi.biz</a>）から送信されています。<br>
              心当たりがない場合はこのメールを無視してください。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
