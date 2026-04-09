'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CustomerSession, ConversationSummary, HumanChat } from '@/types'
import { subscribePush } from '@/lib/push'

export default function OwnerChatPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<CustomerSession | null>(null)
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [chats, setChats] = useState<HumanChat[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null)
  const [senderRole, setSenderRole] = useState<'owner' | 'customer'>('customer')
  const [showSummary, setShowSummary] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [sentOnce, setSentOnce] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()

    // リアルタイム購読（3秒ポーリング不要）
    const channel = supabase
      .channel(`human_chats_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'human_chats', filter: `session_id=eq.${sessionId}` },
        payload => {
          setChats(prev => {
            const exists = prev.some(c => c.id === (payload.new as HumanChat).id)
            return exists ? prev : [...prev, payload.new as HumanChat]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    const { data: sessionData } = await supabase
      .from('customer_sessions').select('*, personas(*, profiles:user_id(*)), business_cards(*)')
      .eq('id', sessionId).single()
    if (sessionData) {
      setSession(sessionData as CustomerSession)
      const personaUserId = (sessionData as CustomerSession & { personas?: { user_id?: string } }).personas?.user_id
      const isOwner = user && personaUserId === user.id
      if (isOwner) {
        setSenderRole('owner')
        // オーナーも通知購読（お客様からのメッセージを受け取る）
        subscribePush(sessionId, 'owner').then(ok => setPushEnabled(ok))
      } else {
        // お客様として開いている場合も購読
        subscribePush(sessionId, 'customer').then(ok => setPushEnabled(ok))
      }
    }
    const { data: summaryData } = await supabase
      .from('conversation_summaries').select('*').eq('session_id', sessionId)
      .order('created_at', { ascending: false }).limit(1).single()
    if (summaryData) setSummary(summaryData)
    fetchChats()
  }

  const fetchChats = useCallback(async () => {
    const { data } = await supabase
      .from('human_chats').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
    if (data) setChats(data)
  }, [sessionId])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const content = input.trim()
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/human-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, senderRole, content }),
      })
      const { chat } = await res.json()
      if (chat) {
        setChats(prev => [...prev, chat])
        setSentOnce(true)
      }

      // 相手へプッシュ通知
      const targetRole = senderRole === 'owner' ? 'customer' : 'owner'
      const senderName = senderRole === 'owner' ? ownerName : customerName
      fetch('/api/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          targetRole,
          title: `💬 ${senderName}からメッセージ`,
          body: content.length > 60 ? content.slice(0, 60) + '…' : content,
          url: `${window.location.origin}/owner/chat/${sessionId}`,
        }),
      })
    } finally { setLoading(false) }
  }

  const ownerName = session?.business_cards?.full_name || '担当者'
  const customerName = session?.customer_name || 'お客様'
  const myName = senderRole === 'owner' ? ownerName : customerName
  const otherName = senderRole === 'owner' ? customerName : ownerName
  const myColor = senderRole === 'owner' ? '#7C3AED' : '#6366F1'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F4F3FA" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 shadow-sm" style={{ background: '#1E1B4B' }}>
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="flex items-center -space-x-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: '#6366F1', borderColor: '#1E1B4B' }}>
              {ownerName[0]}
            </div>
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: '#8B5CF6', borderColor: '#1E1B4B' }}>
              {customerName[0]}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm truncate">{ownerName} × {customerName}</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {senderRole === 'owner'
                ? '本会話 · 分身AIが事前整理済み · オーナーとして参加'
                : '📩 送って閉じてOK · 返信が来たら通知します'}
            </p>
          </div>
          <button onClick={() => setShowSummary(!showSummary)}
            className="text-xs px-3 py-1.5 rounded-full flex-shrink-0 transition"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
            {showSummary ? '要約を閉じる' : '要約を見る'}
          </button>
        </div>
      </div>

      {/* まとめプレビュー */}
      {showSummary && summary && (
        <div className="border-b px-4 py-3" style={{ background: '#F5F3FF', borderColor: '#DDD6FE' }}>
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-black mb-2.5" style={{ color: '#5B21B6' }}>AI事前整理サマリー</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'purpose', label: '目的' },
                { key: 'problems', label: '悩み' },
                { key: 'unresolved_points', label: '未解決' },
                { key: 'compatibility_score', label: '相性' },
              ].map(({ key, label }) => {
                const val = summary[key as keyof ConversationSummary] as string
                if (!val) return null
                return (
                  <div key={key} className="rounded-xl p-2.5" style={{ background: 'white' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#7C3AED' }}>{label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#4A4870' }}>{val}</p>
                  </div>
                )
              })}
            </div>
            <button onClick={() => router.push(`/summary/${sessionId}`)}
              className="text-xs font-medium mt-2 transition" style={{ color: '#7C3AED' }}>
              まとめ全文を見る →
            </button>
          </div>
        </div>
      )}

      {/* 役割切替（未ログイン向け） */}
      {!currentUser && (
        <div className="px-4 py-2.5 border-b" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <p className="text-xs font-bold" style={{ color: '#1D4ED8' }}>あなたは：</p>
            {[
              { role: 'customer' as const, label: `${customerName}（お客様）`, active: '#2563EB' },
              { role: 'owner' as const, label: `${ownerName}（本人）`, active: '#7C3AED' },
            ].map(({ role, label, active }) => (
              <button key={role} onClick={() => setSenderRole(role)}
                className="text-xs px-3 py-1.5 rounded-full transition font-medium"
                style={senderRole === role
                  ? { background: active, color: 'white' }
                  : { border: `1.5px solid ${active}`, color: active, background: 'transparent' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* メッセージ */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">
        {chats.length === 0 && (
          senderRole === 'customer' ? (
            /* お客様向け：非同期メッセージであることを明示 */
            <div className="fade-in py-8 px-2 space-y-4">
              {/* メインカード */}
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid #E8E6F5' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontSize: 18 }}>
                    {ownerName[0]}
                  </div>
                  <div>
                    <p className="font-black text-sm" style={{ color: '#1E1B4B' }}>{ownerName}へ直接メッセージ</p>
                    <p className="text-xs" style={{ color: '#9896B8' }}>分身AIが整理した内容をもとに対応します</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { icon: '📩', text: 'メッセージを送ったら、このページを閉じてOK' },
                    { icon: '🔔', text: '返信が届いたらスマホに通知が来ます' },
                    { icon: '⏱️', text: '通常24時間以内に返信します' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                      <p className="text-sm" style={{ color: '#4A4870' }}>{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 通知許可 */}
              {!pushEnabled && (
                <div className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>返信通知をオンにする</p>
                    <p className="text-xs" style={{ color: '#3B82F6' }}>ページを閉じても返信が届きます</p>
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await subscribePush(sessionId, 'customer')
                      setPushEnabled(ok)
                    }}
                    style={{
                      background: '#2563EB', color: 'white', fontWeight: 700,
                      fontSize: 12, padding: '8px 14px', borderRadius: 20,
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                    }}>
                    通知をオン
                  </button>
                </div>
              )}
              {pushEnabled && (
                <div className="rounded-2xl p-3.5 flex items-center gap-2.5"
                  style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0' }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <p className="text-sm font-medium" style={{ color: '#059669' }}>
                    通知オン · 返信が来たらお知らせします
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* オーナー向け */
            <div className="text-center py-12 fade-in">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "#EEF2FF" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="font-bold mb-1" style={{ color: "#1E1B4B" }}>会話を始めましょう</p>
              <p className="text-sm" style={{ color: "#9896B8" }}>分身AIが事前に整理してくれています</p>
            </div>
          )
        )}
        {chats.map(chat => {
          const isMe = chat.sender_role === senderRole
          const isOwner = chat.sender_role === 'owner'
          const senderName = isOwner ? ownerName : customerName
          const bubbleColor = isOwner ? '#7C3AED' : '#6366F1'
          return (
            <div key={chat.id} className={`flex gap-2.5 fade-up ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                  style={{ background: bubbleColor }}>
                  {senderName[0]}
                </div>
              )}
              <div className="max-w-xs sm:max-w-md">
                <p className={`text-xs mb-1 ${isMe ? 'text-right' : 'text-left'}`} style={{ color: "#9896B8" }}>
                  {senderName}
                </p>
                <div className={`px-4 py-3 text-sm shadow-sm ${isMe ? 'text-white' : ''}`}
                  style={{
                    borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    background: isMe ? bubbleColor : 'var(--surface)',
                    border: isMe ? 'none' : '1px solid var(--border)',
                    whiteSpace: 'pre-wrap',
                    color: isMe ? 'white' : 'var(--text)',
                    boxShadow: isMe ? `0 2px 8px ${bubbleColor}40` : 'var(--shadow-sm)',
                  }}>
                  {chat.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 送信後バナー（お客様向け） */}
      {sentOnce && senderRole === 'customer' && (
        <div className="px-4 py-2.5 border-t" style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}>
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <span style={{ fontSize: 16 }}>✅</span>
            <p className="text-sm font-medium" style={{ color: '#059669' }}>
              送信しました。このページを閉じても、返信が来たら通知でお知らせします。
            </p>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="px-4 pb-6 pt-3 max-w-2xl mx-auto w-full">
        <div className="flex gap-2 p-2 rounded-2xl shadow-md" style={{ background: "#fff", border: "1.5px solid #E8E6F5" }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            placeholder={`${myName}として送信...`}
            className="flex-1 bg-transparent outline-none px-3 text-sm"
            style={{ color: "#1E1B4B" }}
          />
          <button onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 text-sm rounded-xl font-bold text-white transition disabled:opacity-50"
            style={{ background: myColor, borderRadius: '14px' }}>
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-center mt-2" style={{ color: "#9896B8" }}>
          {myName}として送信 · {otherName}がリアルタイムで確認できます
        </p>
      </div>
    </div>
  )
}
