'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, ConversationSummary } from '@/types'

const summaryItems = [
  { key: 'purpose',           label: '相談目的',    color: '#6366F1', bg: '#EEF2FF', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )},
  { key: 'problems',          label: 'お悩み・課題', color: '#DC2626', bg: '#FEF2F2', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { key: 'interests',         label: '興味・関心',   color: '#0369A1', bg: '#EFF6FF', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
  { key: 'compatibility_score', label: '相性評価',  color: '#059669', bg: '#ECFDF5', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )},
  { key: 'unresolved_points', label: '未解決の論点',  color: '#D97706', bg: '#FFFBEB', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { key: 'next_action',       label: '推奨アクション', color: '#7C3AED', bg: '#F5F3FF', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )},
]

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<CustomerSession | null>(null)
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [sessionId])

  const loadData = async () => {
    const { data: sessionData } = await supabase
      .from('customer_sessions').select('*, personas(*, profiles:user_id(*)), business_cards(*)')
      .eq('id', sessionId).single()
    if (sessionData) setSession(sessionData as CustomerSession)
    const { data: summaryData } = await supabase
      .from('conversation_summaries').select('*').eq('session_id', sessionId)
      .order('created_at', { ascending: false }).limit(1).single()
    if (summaryData) setSummary(summaryData)
    setLoading(false)
  }

  const ownerName = session?.business_cards?.full_name || '担当者'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F3FA" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 rounded-full spin mx-auto mb-3"
            style={{ border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: "#9896B8" }}>まとめを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "#F4F3FA" }}>
      {/* Header */}
      <div className="" style={{ background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 50%, #7C3AED 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white mb-1">会話まとめ</h1>
          <p className="text-white/60 text-sm">AIが整理した内容 · {ownerName}との会話前に確認</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 参加者 */}
        <div className="card p-4 flex items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              {(session?.customer_name || '顧')[0]}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: "#1E1B4B" }}>
                {session?.customer_name || '顧客'}
              </p>
              <p className="text-xs" style={{ color: "#9896B8" }}>お客様</p>
            </div>
          </div>
          <div className="px-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <div className="text-right min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: "#1E1B4B" }}>{ownerName}</p>
              <p className="text-xs" style={{ color: "#9896B8" }}>本人（AI分身）</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
              {ownerName[0]}
            </div>
          </div>
        </div>

        {/* まとめカード */}
        {summary ? (
          <div className="space-y-3">
            {summaryItems.map(({ key, label, color, bg, icon }) => {
              const value = summary[key as keyof ConversationSummary] as string
              if (!value) return null
              return (
                <div key={key} className="card p-4" style={{ borderLeft: `3px solid ${color}` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: bg, color }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold mb-1" style={{ color }}>{label}</p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{value}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📝</div>
            <p className="font-bold mb-1" style={{ color: "#1E1B4B" }}>まとめはまだありません</p>
            <button onClick={() => router.push(`/chat/${sessionId}`)}
              className="text-sm font-medium mt-2" style={{ color: "#6366F1" }}>
              会話に戻る →
            </button>
          </div>
        )}

        {/* アクション */}
        <div className="space-y-3 pt-2">
          <button onClick={() => router.push(`/owner/chat/${sessionId}`)}
            className="btn-primary w-full py-4 text-base" style={{ borderRadius: 'var(--radius-lg)' }}>
            {ownerName}本人とチャットを始める →
          </button>
          <button onClick={() => router.push(`/chat/${sessionId}`)}
            className="btn-ghost w-full py-3" style={{ borderRadius: 'var(--radius-lg)' }}>
            ← AI分身との会話に戻る
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: "#9896B8" }}>
          このまとめは{ownerName}と共有されます
        </p>
      </div>
    </div>
  )
}
