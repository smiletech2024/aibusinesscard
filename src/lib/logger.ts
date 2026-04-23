/**
 * 構造化ロガー
 * JSON形式で出力し、Vercel Log Drains / Datadog 等で解析可能にする
 */

type LogData = Record<string, unknown>

function serialize(level: string, event: string, data?: LogData, err?: unknown) {
  return JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...(data ?? {}),
    ...(err !== undefined
      ? {
          error:
            err instanceof Error
              ? { message: err.message, stack: err.stack }
              : String(err),
        }
      : {}),
  })
}

export const logger = {
  info:  (event: string, data?: LogData) =>
    console.log(serialize('info', event, data)),

  warn:  (event: string, data?: LogData) =>
    console.warn(serialize('warn', event, data)),

  error: (event: string, err: unknown, data?: LogData) =>
    console.error(serialize('error', event, data, err)),
}
