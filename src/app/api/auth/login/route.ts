import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS  = 5          // 最大試行回数
const LOCK_MINUTES  = 15         // ロック時間（分）
const RESET_HOURS   = 1          // 成功 or 時間経過でリセット

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getIdentifier(req: NextRequest, email: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  return `${ip}::${email.toLowerCase()}`
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
    }

    const admin      = getAdmin()
    const identifier = getIdentifier(req, email)
    const now        = new Date()

    // ── 現在の試行記録を取得 ──────────────────────────────────
    const { data: record } = await admin
      .from('login_attempts')
      .select('attempts, locked_until, last_attempt')
      .eq('identifier', identifier)
      .maybeSingle()

    if (record) {
      // ロック中チェック
      if (record.locked_until && new Date(record.locked_until) > now) {
        const remaining = Math.ceil((new Date(record.locked_until).getTime() - now.getTime()) / 1000)
        return NextResponse.json(
          { error: 'locked', remaining, lockedUntil: record.locked_until },
          { status: 429 }
        )
      }

      // 1時間以上経過していれば試行回数リセット
      const lastAttempt = new Date(record.last_attempt)
      if ((now.getTime() - lastAttempt.getTime()) > RESET_HOURS * 60 * 60 * 1000) {
        await admin.from('login_attempts').delete().eq('identifier', identifier)
      }
    }

    // ── Supabase でログイン試行 ──────────────────────────────
    const anonClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({ email, password })

    if (authError || !authData.session) {
      // 失敗 → 試行回数を増やす
      const currentAttempts = (record?.locked_until && new Date(record.locked_until) < now ? 0 : (record?.attempts ?? 0)) + 1
      const shouldLock      = currentAttempts >= MAX_ATTEMPTS
      const lockedUntil     = shouldLock
        ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null

      await admin.from('login_attempts').upsert({
        identifier,
        attempts:     currentAttempts,
        locked_until: lockedUntil,
        last_attempt: now.toISOString(),
      }, { onConflict: 'identifier' })

      if (shouldLock) {
        return NextResponse.json(
          { error: 'locked', remaining: LOCK_MINUTES * 60, lockedUntil },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          error:       'invalid_credentials',
          attempts:    currentAttempts,
          maxAttempts: MAX_ATTEMPTS,
          remaining:   MAX_ATTEMPTS - currentAttempts,
        },
        { status: 401 }
      )
    }

    // ── 成功 → 試行記録をリセット ──────────────────────────
    await admin.from('login_attempts').delete().eq('identifier', identifier)

    return NextResponse.json({
      access_token:  authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at:    authData.session.expires_at,
    })
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
