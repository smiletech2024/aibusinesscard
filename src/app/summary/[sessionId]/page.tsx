'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, ConversationSummary } from '@/types'

const summaryItems = [
  { key: 'purpose', label: '相談目的', color: '#F5843A', border: '#F5843A', icon: (
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
  // compatibility_score は数値なのでスコアバーで別途表示
  { key: 'unresolved_points', label: '未解決の論点', color: '#E8C547', border: '#E8C547', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { key: 'next_action', label: '推奨アクション', color: '#F5C09A', border: '#F5C09A', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )},
]

function FollowUpCard({ message, ownerName }: { message: string; ownerName: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: '#0F0E20',
        border: '1px solid rgba(52,211,153,0.25)',
        borderLeft: '3px solid #34D399',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold" style={{ color: '#34D399' }}>
              💬 そのままコピペできるフォローアップ文
            </p>
            <button
              onClick={copy}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.1)',
                color: copied ? '#34D399' : '#6EE7B7',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.2)'}`,
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#A08068', whiteSpace: 'pre-wrap' }}>
            {message}
          </p>
          <p className="text-xs mt-2" style={{ color: '#4A3020' }}>
            ↑ {ownerName}さんがそのまま顧客に送れる文章です
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<CustomerSession | null>(null)
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
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

    // オーナー判定
    const { data: { user } } = await supabase.auth.getUser()
    if (user && sessionData) {
      const ownerUserId = (sessionData as { personas?: { user_id?: string } }).personas?.user_id
      setIsOwner(user.id === ownerUserId)
    }

    setLoading(false)
  }

  const ownerName = session?.business_cards?.full_name || '担当者'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07060F' }}>
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full spin mx-auto mb-3"
            style={{ border: '3px solid rgba(242,103,34,0.3)', borderTopColor: '#F5843A' }}
          />
          <p className="text-sm" style={{ color: '#6B4030' }}>まとめを読み込み中...</p>
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
              background: 'rgba(242,103,34,0.1)',
              border: '1px solid rgba(242,103,34,0.3)',
              boxShadow: '0 0 30px rgba(242,103,34,0.2)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F59340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#FFF0E8' }}>AIがすべて整理しました</h1>
          <p className="text-sm mb-6" style={{ color: '#A08068' }}>
            {ownerName}本人に話しかける前に、確認しておきましょう
          </p>

          {/* Participants */}
          <div className="inline-flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(242,103,34,0.12)', border: '1px solid rgba(242,103,34,0.2)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #E05A18, #F5843A)' }}
              >
                {(session?.customer_name || '顧')[0]}
              </div>
              <span className="text-xs font-medium" style={{ color: '#A08068' }}>
                {session?.customer_name || '顧客'}
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B4030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(242,103,34,0.12)', border: '1px solid rgba(242,103,34,0.2)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #D4691E, #D4551A)' }}
              >
                {ownerName[0]}
              </div>
              <span className="text-xs font-medium" style={{ color: '#A08068' }}>{ownerName}</span>
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
                    border: `1px solid rgba(242,103,34,0.1)`,
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
                      <p className="text-sm leading-relaxed" style={{ color: '#A08068', whiteSpace: 'pre-wrap' }}>{value}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {/* BANT分析 + フォローアップメッセージ */}
            {(() => {
              try {
                const raw = summary.raw_summary ? JSON.parse(summary.raw_summary.match(/\{[\s\S]*\}/)?.[0] || '{}') : {}
                const bant = raw.bant
                const followUp = raw.follow_up_message as string | undefined
                const hotScore = raw.hot_score as string | undefined
                const score = parseInt(String(summary.compatibility_score ?? '0'), 10)
                return (
                  <>
                    {/* 相性スコア可視化 — オーナーのみ */}
                    {isOwner && !isNaN(score) && score > 0 && (
                      <div
                        className="p-4 rounded-xl"
                        style={{
                          background: '#0F0E20',
                          border: `1px solid ${score >= 80 ? 'rgba(245,158,11,0.3)' : score >= 60 ? 'rgba(242,103,34,0.2)' : 'rgba(156,163,175,0.15)'}`,
                          borderLeft: `3px solid ${score >= 80 ? '#F59E0B' : score >= 60 ? '#F26722' : '#6B7280'}`,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: score >= 80 ? '#F59E0B18' : '#F2672218', color: score >= 80 ? '#F59E0B' : '#F26722' }}
                          >
                            <span style={{ fontSize: 14 }}>{score >= 80 ? '🔥' : score >= 60 ? '🌡' : '❄️'}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-bold" style={{ color: score >= 80 ? '#F59E0B' : score >= 60 ? '#F26722' : '#6B7280' }}>
                                相性スコア
                              </p>
                              <span className="font-black text-2xl" style={{ color: score >= 80 ? '#F59E0B' : score >= 60 ? '#F26722' : '#9CA3AF', lineHeight: 1 }}>
                                {score}
                              </span>
                              <span className="text-xs" style={{ color: '#6B4030' }}>/ 100</span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: score >= 80 ? 'rgba(245,158,11,0.15)' : 'rgba(156,163,175,0.1)', color: score >= 80 ? '#F59E0B' : '#9CA3AF' }}>
                                {score >= 80 ? '熱い見込み客' : score >= 60 ? '普通' : '情報収集段階'}
                              </span>
                            </div>
                            {/* スコアバー */}
                            <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${score}%`,
                                  borderRadius: 9999,
                                  background: score >= 80
                                    ? 'linear-gradient(90deg,#F59E0B,#FCD34D)'
                                    : score >= 60
                                    ? 'linear-gradient(90deg,#F26722,#F59340)'
                                    : 'linear-gradient(90deg,#6B7280,#9CA3AF)',
                                  transition: 'width 0.8s ease',
                                }}
                              />
                            </div>
                            {hotScore && (
                              <p className="text-xs mt-1.5" style={{ color: '#6B4030' }}>{hotScore}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BANT分析 — オーナーのみ */}
                    {isOwner && bant && (
                      <div
                        className="p-4 rounded-xl"
                        style={{
                          background: '#0F0E20',
                          border: '1px solid rgba(242,103,34,0.1)',
                          borderLeft: '3px solid #F59E0B',
                          borderLeftColor: '#F59E0B',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: '#F59E0B18', color: '#F59E0B' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold mb-2" style={{ color: '#F59E0B' }}>BANT分析</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: '予算 (Budget)', value: bant.budget },
                                { label: '決裁権 (Authority)', value: bant.authority },
                                { label: 'ニーズ (Need)', value: bant.need },
                                { label: '時期 (Timeline)', value: bant.timeline },
                              ].map(({ label, value }) => value && (
                                <div key={label}>
                                  <p className="text-xs font-bold mb-0.5" style={{ color: '#6B4030' }}>{label}</p>
                                  <p className="text-sm" style={{ color: '#A08068' }}>{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* フォローアップメッセージ — オーナーのみ */}
                    {isOwner && followUp && (
                      <FollowUpCard message={followUp} ownerName={ownerName} />
                    )}
                  </>
                )
              } catch { return null }
            })()}
          </div>
        ) : (
          <div
            className="p-8 text-center rounded-xl"
            style={{ background: '#0F0E20', border: '1px solid rgba(242,103,34,0.1)' }}
          >
            <div className="text-4xl mb-3">📝</div>
            <p className="font-bold mb-1" style={{ color: '#FFF0E8' }}>まだ整理が完了していません</p>
            <button
              onClick={() => router.push(`/chat/${sessionId}`)}
              className="text-sm font-medium mt-2"
              style={{ color: '#F5843A', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              会話に戻る →
            </button>
          </div>
        )}

        {/* アクション */}
        <div className="space-y-3 pt-2">
          <button
            onClick={async () => {
              // セッションステータスを owner_chat に更新（オーナーへの通知トリガー）
              await supabase
                .from('customer_sessions')
                .update({ status: 'owner_chat', updated_at: new Date().toISOString() })
                .eq('id', sessionId)
              // お客様はチャットページへ（オーナーからのメッセージを3秒ポーリングで受信）
              router.push(`/chat/${sessionId}`)
            }}
            className="w-full py-4 text-base font-bold text-white rounded-2xl transition hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #F5843A, #F59340)',
              boxShadow: '0 8px 30px rgba(242,103,34,0.45)',
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

        <p className="text-xs text-center" style={{ color: '#6B4030' }}>
          このまとめは{ownerName}にも届いています
        </p>
      </div>
    </div>
  )
}
