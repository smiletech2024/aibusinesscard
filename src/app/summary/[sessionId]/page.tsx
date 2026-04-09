'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, ConversationSummary } from '@/types'

const summaryItems = [
  { key: 'purpose', label: '相談目的', color: '#7B6EF5', border: '#7B6EF5', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )},
  { key: 'problems', label: 'お悩み・課題', color: '#F87171', border: '#F87171', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { key: 'interests', label: '興味・関心', color: '#60A5FA', border: '#60A5FA', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
  { key: 'compatibility_score', label: '相性評価', color: '#34D399', border: '#34D399', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )},
  { key: 'unresolved_points', label: '未解決の論点', color: '#E8C547', border: '#E8C547', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { key: 'next_action', label: '推奨アクション', color: '#A78BFA', border: '#A78BFA', icon: (
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07060F' }}>
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full spin mx-auto mb-3"
            style={{ border: '3px solid rgba(123,110,245,0.3)', borderTopColor: '#7B6EF5' }}
          />
          <p className="text-sm" style={{ color: '#5A587E' }}>まとめを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#07060F' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #0F0E20 0%, #1A1040 100%)' }}>
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          {/* Glow ring icon */}
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
            style={{
              background: 'rgba(123,110,245,0.1)',
              border: '1px solid rgba(123,110,245,0.3)',
              boxShadow: '0 0 30px rgba(123,110,245,0.2)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#9B8BF5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#EDEEFF' }}>AIがすべて整理しました</h1>
          <p className="text-sm mb-6" style={{ color: '#9896C4' }}>
            {ownerName}本人に話しかける前に、確認しておきましょう
          </p>

          {/* Participants */}
          <div className="inline-flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(123,110,245,0.12)', border: '1px solid rgba(123,110,245,0.2)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #6356D4, #7B6EF5)' }}
              >
                {(session?.customer_name || '顧')[0]}
              </div>
              <span className="text-xs font-medium" style={{ color: '#9896C4' }}>
                {session?.customer_name || '顧客'}
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A587E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(123,110,245,0.12)', border: '1px solid rgba(123,110,245,0.2)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}
              >
                {ownerName[0]}
              </div>
              <span className="text-xs font-medium" style={{ color: '#9896C4' }}>{ownerName}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* まとめカード */}
        {summary ? (
          <div className="space-y-3">
            {summaryItems.map(({ key, label, color, border, icon }) => {
              const value = summary[key as keyof ConversationSummary] as string
              if (!value) return null
              return (
                <div
                  key={key}
                  className="p-4 rounded-xl"
                  style={{
                    background: '#0F0E20',
                    borderLeft: `3px solid ${border}`,
                    border: `1px solid rgba(139,92,246,0.1)`,
                    borderLeftColor: border,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}18`, color }}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold mb-1" style={{ color }}>{label}</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#9896C4', whiteSpace: 'pre-wrap' }}>{value}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className="p-8 text-center rounded-xl"
            style={{ background: '#0F0E20', border: '1px solid rgba(139,92,246,0.1)' }}
          >
            <div className="text-4xl mb-3">📝</div>
            <p className="font-bold mb-1" style={{ color: '#EDEEFF' }}>まだ整理が完了していません</p>
            <button
              onClick={() => router.push(`/chat/${sessionId}`)}
              className="text-sm font-medium mt-2"
              style={{ color: '#7B6EF5', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              会話に戻る →
            </button>
          </div>
        )}

        {/* アクション */}
        <div className="space-y-3 pt-2">
          <button
            onClick={async () => {
              // セッションステータスを owner_chat に更新（通知トリガー）
              await supabase
                .from('customer_sessions')
                .update({ status: 'owner_chat', updated_at: new Date().toISOString() })
                .eq('id', sessionId)
              router.push(`/owner/chat/${sessionId}`)
            }}
            className="w-full py-4 text-base font-bold text-white rounded-2xl transition hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #7B6EF5, #9B8BF5)',
              boxShadow: '0 8px 30px rgba(123,110,245,0.45)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {ownerName}本人に話しかける →
          </button>
          <button
            onClick={() => router.push(`/chat/${sessionId}`)}
            className="w-full py-3 font-semibold rounded-2xl transition"
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            ← もう少しAIと話す
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: '#5A587E' }}>
          このまとめは{ownerName}にも届いています
        </p>
      </div>
    </div>
  )
}
