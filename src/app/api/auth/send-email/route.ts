import { NextRequest, NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM          = 'AI名刺 <noreply@aimeishi.biz>'
const SITE_URL      = 'https://www.aimeishi.biz'

// ── メールテンプレート ──────────────────────────────────────────
function buildEmail(type: string, confirmUrl: string) {
  const btn = `
    <div style="text-align:center;margin:32px 0">
      <a href="${confirmUrl}"
        style="background:linear-gradient(135deg,#F26722,#F59340);color:#fff;font-weight:800;
               padding:14px 36px;border-radius:99px;text-decoration:none;
               display:inline-block;font-size:15px;letter-spacing:0.02em">
        %LABEL%
      </a>
    </div>`

  const footer = `
    <hr style="border:none;border-top:1px solid #EDD9C8;margin:28px 0">
    <p style="color:#A08068;font-size:11px;text-align:center">
      AI名刺 &nbsp;|&nbsp;
      <a href="${SITE_URL}" style="color:#F26722;text-decoration:none">aimeishi.biz</a>
    </p>`

  const wrap = (body: string) => `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
                max-width:480px;margin:0 auto;padding:36px 28px;background:#FAF5F0;
                border-radius:16px">
      <div style="margin-bottom:24px;text-align:center">
        <span style="font-size:22px;font-weight:900;color:#F26722">AI名刺</span>
      </div>
      ${body}
      ${footer}
    </div>`

  switch (type) {
    case 'signup':
      return {
        subject: '【AI名刺】メールアドレスを確認してください',
        html: wrap(`
          <h2 style="color:#1C0F05;font-size:20px;font-weight:900;margin-bottom:12px">
            ご登録ありがとうございます 🎉
          </h2>
          <p style="color:#4A2C1A;line-height:1.8;margin-bottom:8px">
            AI名刺へようこそ！<br>
            下のボタンをクリックしてメールアドレスを確認してください。
          </p>
          <p style="color:#A08068;font-size:12px">このリンクは24時間有効です。</p>
          ${btn.replace('%LABEL%', 'メールアドレスを確認する ✓')}
          <p style="color:#A08068;font-size:12px;text-align:center">
            心当たりがない場合は無視してください。
          </p>
        `),
      }

    case 'recovery':
      return {
        subject: '【AI名刺】パスワードリセットのご案内',
        html: wrap(`
          <h2 style="color:#1C0F05;font-size:20px;font-weight:900;margin-bottom:12px">
            パスワードリセット
          </h2>
          <p style="color:#4A2C1A;line-height:1.8;margin-bottom:8px">
            パスワードリセットのリクエストを受け付けました。<br>
            下のボタンから新しいパスワードを設定してください。
          </p>
          <p style="color:#A08068;font-size:12px">このリンクは1時間有効です。</p>
          ${btn.replace('%LABEL%', 'パスワードを再設定する')}
          <p style="color:#A08068;font-size:12px;text-align:center">
            心当たりがない場合は無視してください。
          </p>
        `),
      }

    case 'email_change_current':
    case 'email_change_new':
      return {
        subject: '【AI名刺】メールアドレス変更の確認',
        html: wrap(`
          <h2 style="color:#1C0F05;font-size:20px;font-weight:900;margin-bottom:12px">
            メールアドレス変更の確認
          </h2>
          <p style="color:#4A2C1A;line-height:1.8">
            メールアドレスの変更リクエストを受け付けました。<br>
            下のボタンをクリックして変更を確定してください。
          </p>
          ${btn.replace('%LABEL%', '変更を確認する')}
        `),
      }

    default:
      return {
        subject: '【AI名刺】確認メール',
        html: wrap(`
          <p style="color:#4A2C1A;line-height:1.8">
            下のボタンをクリックして操作を完了してください。
          </p>
          ${btn.replace('%LABEL%', '確認する')}
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

    const { token_hash, email_action_type, site_url } = email_data
    const type = email_action_type as string

    // 確認URL（/auth/confirm ページへ）
    const base       = site_url || SITE_URL
    const confirmUrl = `${base}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(type)}`

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
