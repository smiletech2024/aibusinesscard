/**
 * Next.js Instrumentation Hook
 * サーバー起動時に環境変数の存在チェックを行う
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DEEPSEEK_API_KEY',
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'CRON_SECRET',
    'ADMIN_EMAIL',
    'VAPID_SUBJECT',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ]

  const missing = required.filter(k => !process.env[k])
  if (missing.length > 0) {
    // 本番環境（NODE_ENV=production）では警告をエラーとして扱う
    const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'warn'
    console[logLevel === 'error' ? 'error' : 'warn'](
      JSON.stringify({
        level: logLevel,
        event: 'startup:env_missing',
        missing,
        ts:    new Date().toISOString(),
        hint:  '本番環境ではすべての環境変数を設定してください',
      })
    )
  } else {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'startup:env_ok',
        count: required.length,
        ts:    new Date().toISOString(),
      })
    )
  }
}
