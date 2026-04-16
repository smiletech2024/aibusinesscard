import { NextRequest, NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM          = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL      = 'https://www.aimeishi.biz'

// ── メールテンプレート ──────────────────────────────────────────
function buildEmail(type: string, confirmUrl: string) {
  // グラデーションはメールクライアントで無視されるためソリッドカラーを使用
  const btn = (label: string) => `
    <div style="text-align:center;margin:32px 0">
      <a href="${confirmUrl}"
        style="background-color:#F26722;color:#ffffff;font-weight:800;
               padding:16px 40px;border-radius:8px;text-decoration:none;
               display:inline-block;font-size:16px;
               border:2px solid #F26722;mso-padding-alt:0">
        ${label}
      </a>
    </div>
    <p style="text-align:center;margin-top:12px">
      <a href="${confirmUrl}" style="color:#F26722;font-size:12px;word-break:break-all">
        リンクが開かない場合はこちらをクリック
      </a>
    </p>`

  const footer = `
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:28px 0">
    <p style="color:#999999;font-size:11px;text-align:center;line-height:1.8">
      このメールはAI名刺（<a href="${SITE_URL}" style="color:#F26722;text-decoration:none">aimeishi.biz</a>）から送信されています。<br>
      心当たりがない場合はこのメールを無視してください。
    </p>`

  const wrap = (title: string, body: string) => `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- ヘッダー -->
        <tr>
          <td style="background-color:#F26722;padding:24px 32px;text-align:center">
            <span style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:0.02em">AI名刺</span>
          </td>
        </tr>
        <!-- 本文 -->
        <tr>
          <td style="padding:36px 32px">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#1a1a1a">${title}</h2>
            ${body}
          </td>
        </tr>
        <!-- フッター -->
        <tr>
          <td style="padding:0 32px 32px">
            ${footer}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  switch (type) {
    case 'signup':
      return {
        subject: '【AI名刺】メールアドレスを確認してください',
        html: wrap('ご登録ありがとうございます！', `
          <p style="margin:0 0 8px;color:#333333;line-height:1.8;font-size:15px">
            AI名刺へようこそ！🎉<br>
            以下のボタンをクリックしてメールアドレスの確認を完了してください。
          </p>
          <p style="margin:0 0 24px;color:#888888;font-size:13px">
            ※ このリンクは<strong>24時間</strong>有効です。
          </p>
          ${btn('メールアドレスを確認する')}
          <p style="margin:24px 0 0;color:#888888;font-size:13px;line-height:1.7;background:#fff8f5;border-left:3px solid #F26722;padding:12px 16px;border-radius:4px">
            確認完了後、無料でAI分身の作成を始められます。<br>
            初回登録ボーナスとして<strong style="color:#F26722">約100回分のAI会話</strong>をプレゼントします。
          </p>
        `),
      }

    case 'recovery':
      return {
        subject: '【AI名刺】パスワードリセットのご案内',
        html: wrap('パスワードリセット', `
          <p style="margin:0 0 8px;color:#333333;line-height:1.8;font-size:15px">
            パスワードリセットのリクエストを受け付けました。<br>
            以下のボタンから新しいパスワードを設定してください。
          </p>
          <p style="margin:0 0 24px;color:#888888;font-size:13px">
            ※ このリンクは<strong>1時間</strong>有効です。
          </p>
          ${btn('パスワードを再設定する')}
        `),
      }

    case 'email_change_current':
    case 'email_change_new':
      return {
        subject: '【AI名刺】メールアドレス変更の確認',
        html: wrap('メールアドレス変更の確認', `
          <p style="margin:0 0 24px;color:#333333;line-height:1.8;font-size:15px">
            メールアドレスの変更リクエストを受け付けました。<br>
            以下のボタンをクリックして変更を確定してください。
          </p>
          ${btn('変更を確認する')}
        `),
      }

    default:
      return {
        subject: '【AI名刺】操作の確認',
        html: wrap('操作の確認', `
          <p style="margin:0 0 24px;color:#333333;line-height:1.8;font-size:15px">
            以下のボタンをクリックして操作を完了してください。
          </p>
          ${btn('確認する')}
        `),
      }
  }
}

// ── Auth Hook エンドポイント ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user, email_data } = body

    if (!user?.email || !email_data) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { token_hash, email_action_type } = email_data
    const type = email_action_type as string

    // 確認URL（/auth/confirm ページへ）常に自ドメインを使用
    const confirmUrl = `${SITE_URL}/auth/confirm?token_hash=${token_hash}&type=${type}`

    const { subject, html } = buildEmail(type, confirmUrl)

    // Resend API で送信
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [user.email], subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[send-email hook] Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    console.log(`[send-email hook] sent ${type} to ${user.email}`)
    return NextResponse.json({})
  } catch (err) {
    console.error('[send-email hook]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
