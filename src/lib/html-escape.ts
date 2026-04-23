/**
 * HTML エスケープユーティリティ
 * メール本文など HTML を組み立てる箇所でユーザー入力を安全に扱う
 */
const ESCAPE_MAP: Record<string, string> = {
  '&':  '&amp;',
  '<':  '&lt;',
  '>':  '&gt;',
  '"':  '&quot;',
  "'":  '&#39;',
  '/':  '&#x2F;',
}

export function escapeHtml(str: unknown): string {
  if (str == null) return ''
  return String(str).replace(/[&<>"'/]/g, c => ESCAPE_MAP[c] ?? c)
}
