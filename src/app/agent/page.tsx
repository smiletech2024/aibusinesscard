'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ────────── 定数 ──────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  sales:     { label: '営業・販売',   color: '#E8601C', bg: '#FFF0E8' },
  marketing: { label: 'マーケ',       color: '#9D3E0B', bg: '#FCEEE5' },
  tech:      { label: '技術・開発',   color: '#1D4ED8', bg: '#EEF2FF' },
  hiring:    { label: '採用・HR',     color: '#059669', bg: '#ECFDF5' },
  finance:   { label: '財務・経理',   color: '#D97706', bg: '#FFFBEB' },
  ops:       { label: '業務効率化',   color: '#7C3AED', bg: '#F5F3FF' },
  design:    { label: 'デザイン',     color: '#DB2777', bg: '#FDF2F8' },
  legal:     { label: '法務・契約',   color: '#475569', bg: '#F1F5F9' },
  other:     { label: 'その他',       color: '#6B7280', bg: '#F9FAFB' },
}
const BUDGET_LABELS: Record<string, string> = {
  free: '予算なし', under50k: '〜5万円', '50-200k': '5〜20万円',
  '200k-1m': '20〜100万円', '1m+': '100万円〜', undisclosed: '予算非公開',
}
const URGENCY_LABELS: Record<string, string> = {
  asap: '今すぐ', '1month': '1ヶ月以内', '3months': '3ヶ月以内',
  '6months': '6ヶ月以内', no_limit: '急がない',
}
const URGENCY_COLORS: Record<string, string> = {
  asap: '#DC2626', '1month': '#D97706', '3months': '#059669', '6months': '#2563EB', no_limit: '#6B7280',
}

// ────────── 型定義 ────────────────────────────────────
type UserNeed = {
  id: string; user_id: string; category: string; title: string
  description: string; ideal_outcome: string | null
  budget_range: string; urgency: string; is_public: boolean; created_at: string
}
type UserSkill = {
  id: string; user_id: string; category: string; title: string
  description: string; achievements: string | null; ideal_client: string | null; created_at: string
}
type AgentMatch = {
  id: string; skill_user_id: string; need_user_id: string
  skill_id: string; need_id: string; match_score: number; match_reason: string
  approach_message: string | null; status: string; is_read: boolean
  skill_title: string; skill_category: string
  skill_user_name: string; skill_user_company: string; skill_user_title_label: string
  skill_user_card_id: string | null
  need_title: string; need_category: string; need_description: string
  need_budget: string; need_urgency: string
  need_user_name: string; need_user_company: string; need_user_title_label: string
  need_user_card_id: string | null
  created_at: string
}
type ParsedSummary = {
  category: string; title: string; description: string
  ideal_outcome?: string; achievements?: string; ideal_client?: string
  budget_range?: string; urgency?: string
}
type InterviewMsg = { role: 'user' | 'assistant'; content: string }

// ────────── スコアリング ──────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#E8601C' : score >= 65 ? '#D97706' : '#059669'
  const r = 22, c = 28, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#F0E4D0" strokeWidth="4" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 7, color: '#B88860', fontWeight: 600 }}>/ 100</span>
      </div>
    </div>
  )
}

// ────────── メインコンポーネント ──────────────────────
export default function AgentPage() {
  const [tab, setTab] = useState<'needs' | 'skills' | 'matches'>('matches')
  const [needs,   setNeeds]   = useState<UserNeed[]>([])
  const [skills,  setSkills]  = useState<UserSkill[]>([])
  const [outgoing, setOutgoing] = useState<AgentMatch[]>([])
  const [incoming, setIncoming] = useState<AgentMatch[]>([])
  const [loading, setLoading] = useState(true)

  // インタビュー
  const [showInterview, setShowInterview]     = useState(false)
  const [interviewType, setInterviewType]     = useState<'needs' | 'skills'>('needs')
  const [messages, setMessages]               = useState<InterviewMsg[]>([])
  const [inputText, setInputText]             = useState('')
  const [aiTyping, setAiTyping]               = useState(false)
  const [summary, setSummary]                 = useState<ParsedSummary | null>(null)
  const [saving, setSaving]                   = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // エージェント実行
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentMsg, setAgentMsg]         = useState('')

  // アプローチモーダル
  const [approachMatch, setApproachMatch]   = useState<AgentMatch | null>(null)
  const [approachMsg, setApproachMsg]       = useState('')
  const [genLoading, setGenLoading]         = useState(false)
  const [sendLoading, setSendLoading]       = useState(false)
  const [sentIds, setSentIds]               = useState<Set<string>>(new Set())

  // ────── データ取得 ─────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [nr, sr, mr] = await Promise.all([
      fetch('/api/needs').then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
      fetch('/api/agent/matches').then(r => r.json()),
    ])
    setNeeds(Array.isArray(nr) ? nr : [])
    setSkills(Array.isArray(sr) ? sr : [])
    setOutgoing(mr.outgoing ?? [])
    setIncoming(mr.incoming ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, aiTyping])

  // ────── インタビュー開始 ───────────────────────────
  const startInterview = (type: 'needs' | 'skills') => {
    setInterviewType(type)
    setMessages([])
    setInputText('')
    setSummary(null)
    setShowInterview(true)
    // 最初のメッセージを取得
    sendToAI([], type)
  }

  const sendToAI = async (msgs: InterviewMsg[], type?: 'needs' | 'skills') => {
    const endpoint = `/api/${type ?? interviewType}/interview`
    setAiTyping(true)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: full }
          return next
        })
      }

      // [[SUMMARY]] を検出
      if (full.includes('[[SUMMARY]]')) {
        const match = full.match(/\[\[SUMMARY\]\]([\s\S]*?)\[\[\/SUMMARY\]\]/)
        if (match) {
          try {
            const parsed: ParsedSummary = JSON.parse(match[1].trim())
            setSummary(parsed)
          } catch { /* ignore parse error */ }
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiTyping(false)
    }
  }

  const handleUserSend = async () => {
    if (!inputText.trim() || aiTyping || summary) return
    const userMsg: InterviewMsg = { role: 'user', content: inputText.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInputText('')
    await sendToAI(newMsgs)
  }

  // ────── 登録確定 ──────────────────────────────────
  const handleSave = async () => {
    if (!summary) return
    setSaving(true)
    try {
      const endpoint = interviewType === 'needs' ? '/api/needs' : '/api/skills'
      const body = interviewType === 'needs'
        ? { ...summary, interview_log: messages }
        : { ...summary, interview_log: messages }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowInterview(false)
        await fetchAll()
        setTab(interviewType === 'needs' ? 'needs' : 'skills')
      }
    } finally {
      setSaving(false)
    }
  }

  // ────── エージェント実行 ───────────────────────────
  const runAgent = async () => {
    setAgentRunning(true)
    setAgentMsg('')
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setAgentMsg(`⚠️ ${data.error}`)
      } else {
        const n = data.newCount ?? 0
        setAgentMsg(n > 0 ? `✅ ${n}件の案件が見つかりました。確認してみてください。` : '今回は新しい案件が見つかりませんでした。ユーザーが増えると見つかりやすくなります。')
        await fetchAll()
      }
    } catch {
      setAgentMsg('⚠️ エラーが起きました。もう一度お試しください')
    } finally {
      setAgentRunning(false)
    }
  }

  // ────── アプローチ ────────────────────────────────
  const openApproach = async (match: AgentMatch) => {
    setApproachMatch(match)
    setApproachMsg(match.approach_message ?? '')
    if (!match.approach_message) {
      setGenLoading(true)
      const res = await fetch('/api/agent/approach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id }),
      })
      const data = await res.json()
      setApproachMsg(data.message ?? '')
      setGenLoading(false)
      setOutgoing(prev => prev.map(m => m.id === match.id ? { ...m, approach_message: data.message, status: 'interested' } : m))
    }
  }

  const sendApproach = async () => {
    if (!approachMatch || !approachMsg.trim()) return
    setSendLoading(true)
    await fetch('/api/agent/approach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: approachMatch.id, message: approachMsg }),
    })
    setSentIds(prev => new Set([...prev, approachMatch.id]))
    setOutgoing(prev => prev.map(m => m.id === approachMatch.id ? { ...m, status: 'sent' } : m))
    setSendLoading(false)
    setApproachMatch(null)
  }

  // ────── 削除 ─────────────────────────────────────
  const deleteNeed  = async (id: string) => {
    await fetch(`/api/needs?id=${id}`, { method: 'DELETE' })
    setNeeds(prev => prev.filter(n => n.id !== id))
  }
  const deleteSkill = async (id: string) => {
    await fetch(`/api/skills?id=${id}`, { method: 'DELETE' })
    setSkills(prev => prev.filter(s => s.id !== id))
  }
  const togglePublic = async (need: UserNeed) => {
    await fetch('/api/needs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: need.id, is_public: !need.is_public }),
    })
    setNeeds(prev => prev.map(n => n.id === need.id ? { ...n, is_public: !n.is_public } : n))
  }

  const newBadge = outgoing.filter(m => m.status === 'new').length + incoming.length

  // ════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#FBF4EC', fontFamily: 'sans-serif' }}>

      {/* ── ヘッダー ── */}
      <div style={{
        background: 'white', borderBottom: '1px solid rgba(196,136,58,0.18)',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <Link href="/dashboard" style={{ color: '#B88860', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← 戻る
          </Link>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Pulse dot */}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8601C', display: 'inline-block', boxShadow: '0 0 0 2px rgba(232,96,28,0.25)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#2C1806' }}>営業エージェント</span>
          </div>
          {newBadge > 0 && (
            <span style={{
              background: '#E8601C', color: 'white', borderRadius: 12, fontSize: 11, fontWeight: 800,
              padding: '2px 8px', minWidth: 20, textAlign: 'center',
            }}>{newBadge}</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* ── タブ ── */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20, marginBottom: 24, background: 'white', borderRadius: 14, padding: 4, border: '1px solid rgba(196,136,58,0.18)' }}>
          {([
            { key: 'matches', icon: '🎯', label: '案件マッチング', badge: newBadge },
            { key: 'needs',   icon: '📌', label: '今の課題',     badge: needs.length },
            { key: 'skills',  icon: '💡', label: '得意分野',     badge: skills.length },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                background: tab === t.key ? '#2C1806' : 'transparent',
                color: tab === t.key ? 'white' : '#7A4A28',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.badge > 0 && (
                <span style={{
                  background: tab === t.key ? 'rgba(255,255,255,0.3)' : '#E8601C',
                  color: 'white', borderRadius: 8, fontSize: 10, padding: '1px 5px', fontWeight: 800,
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#B88860' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <p style={{ fontSize: 14 }}>読み込み中...</p>
          </div>
        ) : (
          <>
            {/* ══ マッチングタブ ══════════════════════════════ */}
            {tab === 'matches' && (
              <div>
                {/* エージェント実行パネル */}
                <div style={{
                  background: 'white', borderRadius: 20, padding: '24px 20px', marginBottom: 24,
                  border: '1px solid rgba(196,136,58,0.18)',
                  boxShadow: '0 2px 20px rgba(196,136,58,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                      background: '#F0E4D0',
                    }}>
                      <img src="/interviewer.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#2C1806' }}>エージェントに動いてもらう</div>
                      <div style={{ fontSize: 11, color: '#B88860', marginTop: 2 }}>
                        あなたのスキルで解決できる案件を、他ユーザーの中から自動で見つけます
                      </div>
                    </div>
                  </div>

                  {(needs.length === 0 || skills.length === 0) && (
                    <div style={{
                      background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
                      padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E',
                    }}>
                      ⚠️ {needs.length === 0 && skills.length === 0
                        ? '「課題」と「スキル」を登録してからエージェントを実行できます'
                        : needs.length === 0 ? '課題を登録するとマッチングの精度が上がります'
                        : 'スキルを登録してからエージェントを実行できます'}
                    </div>
                  )}

                  <button
                    onClick={runAgent}
                    disabled={agentRunning || skills.length === 0}
                    style={{
                      width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none',
                      background: agentRunning || skills.length === 0
                        ? '#F0E4D0'
                        : 'linear-gradient(135deg,#E8601C,#C4511A)',
                      color: agentRunning || skills.length === 0 ? '#B88860' : 'white',
                      fontSize: 14, fontWeight: 800, cursor: skills.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      transition: 'all 0.2s', boxShadow: agentRunning || skills.length === 0 ? 'none' : '0 4px 16px rgba(232,96,28,0.3)',
                    }}>
                    {agentRunning ? (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                        ほかのユーザーの課題をスキャンしています...
                      </>
                    ) : '🔍 案件を探してもらう'}
                  </button>

                  {agentMsg && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px', borderRadius: 10,
                      background: agentMsg.startsWith('✅') ? '#ECFDF5' : agentMsg.startsWith('⚠️') ? '#FEF2F2' : '#F0F9FF',
                      color: agentMsg.startsWith('✅') ? '#065F46' : agentMsg.startsWith('⚠️') ? '#991B1B' : '#1E40AF',
                      fontSize: 13, fontWeight: 600,
                    }}>{agentMsg}</div>
                  )}
                </div>

                {/* 見つけた案件（outgoing） */}
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#B88860', letterSpacing: '0.1em', marginBottom: 12 }}>
                    対応できそうな案件 ({outgoing.length}件)
                  </div>
                  {outgoing.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 20px', background: 'white', borderRadius: 16, border: '1px dashed rgba(196,136,58,0.3)' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                      <p style={{ fontSize: 13, color: '#B88860', margin: 0 }}>
                        ボタンを押して、エージェントに案件を探させましょう
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {outgoing.map(m => {
                        const isSent = m.status === 'sent' || sentIds.has(m.id)
                        const cat = CATEGORY_META[m.need_category] ?? CATEGORY_META.other
                        return (
                          <div key={m.id} style={{
                            background: 'white', borderRadius: 16, padding: '16px 16px',
                            border: `1px solid ${m.status === 'new' ? 'rgba(232,96,28,0.3)' : 'rgba(196,136,58,0.18)'}`,
                            boxShadow: m.status === 'new' ? '0 2px 16px rgba(232,96,28,0.1)' : 'none',
                          }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <ScoreRing score={m.match_score} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: '2px 7px', borderRadius: 6 }}>{cat.label}</span>
                                  {m.status === 'new' && <span style={{ fontSize: 10, fontWeight: 700, color: '#E8601C', background: '#FFF0E8', padding: '2px 7px', borderRadius: 6 }}>NEW</span>}
                                  {isSent && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 7px', borderRadius: 6 }}>送信済み</span>}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#2C1806', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.need_title}
                                </div>
                                <div style={{ fontSize: 11, color: '#7A4A28', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {m.match_reason}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                  {m.need_budget && m.need_budget !== 'undisclosed' && (
                                    <span style={{ fontSize: 10, color: '#7A4A28', background: '#F0E4D0', padding: '2px 7px', borderRadius: 5 }}>
                                      💰 {BUDGET_LABELS[m.need_budget] ?? m.need_budget}
                                    </span>
                                  )}
                                  {m.need_urgency && (
                                    <span style={{ fontSize: 10, color: URGENCY_COLORS[m.need_urgency] ?? '#6B7280', background: '#FBF4EC', padding: '2px 7px', borderRadius: 5 }}>
                                      ⏱ {URGENCY_LABELS[m.need_urgency] ?? m.need_urgency}
                                    </span>
                                  )}
                                  <span style={{ fontSize: 10, color: '#B88860' }}>
                                    {m.need_user_company || m.need_user_name}
                                  </span>
                                </div>
                                {!isSent && (
                                  <button
                                    onClick={() => openApproach(m)}
                                    style={{
                                      width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                                      background: 'linear-gradient(135deg,#E8601C,#C4511A)',
                                      color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                      boxShadow: '0 3px 10px rgba(232,96,28,0.25)',
                                    }}>
                                    提案する →
                                  </button>
                                )}
                                {isSent && m.need_user_card_id && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <Link
                                      href={`/card/${m.need_user_card_id}`}
                                      style={{
                                        flex: 1, display: 'block', textAlign: 'center',
                                        padding: '9px', borderRadius: 10, textDecoration: 'none',
                                        background: 'linear-gradient(135deg,#059669,#047857)',
                                        color: 'white', fontSize: 12, fontWeight: 700,
                                        boxShadow: '0 3px 10px rgba(5,150,105,0.25)',
                                      }}>
                                      🤝 相手のAI名刺を見る →
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 受け取った提案（incoming） */}
                {incoming.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#B88860', letterSpacing: '0.1em', marginBottom: 12 }}>
                      あなたの課題への提案 ({incoming.length}件)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {incoming.map(m => {
                        const cat = CATEGORY_META[m.need_category] ?? CATEGORY_META.other
                        return (
                          <div key={m.id} style={{
                            background: 'white', borderRadius: 16, padding: 16,
                            border: '1px solid rgba(37,99,235,0.2)',
                            boxShadow: '0 2px 12px rgba(37,99,235,0.06)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📬</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C1806' }}>
                                  {m.skill_user_name} さんが提案しています
                                </div>
                                <div style={{ fontSize: 11, color: '#B88860' }}>
                                  {m.skill_user_company} · {m.skill_title} · 適合度 {m.match_score}点
                                </div>
                              </div>
                            </div>
                            {m.approach_message && (
                              <div style={{
                                background: '#F8FAFF', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 10,
                                padding: '10px 12px', fontSize: 12, color: '#1E3A8A', lineHeight: 1.7,
                                marginBottom: m.skill_user_card_id ? 10 : 0,
                              }}>
                                {m.approach_message}
                              </div>
                            )}
                            {m.skill_user_card_id && (
                              <Link
                                href={`/card/${m.skill_user_card_id}`}
                                style={{
                                  display: 'block', textAlign: 'center',
                                  padding: '9px', borderRadius: 10, textDecoration: 'none',
                                  background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
                                  color: 'white', fontSize: 12, fontWeight: 700,
                                  boxShadow: '0 3px 10px rgba(37,99,235,0.25)',
                                }}>
                                🤝 {m.skill_user_name}さんのAI名刺を見る →
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ 課題タブ ════════════════════════════════════ */}
            {tab === 'needs' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#2C1806' }}>今の課題</div>
                    <div style={{ fontSize: 11, color: '#B88860' }}>課題を登録すると、解決できる人がアプローチしてきます</div>
                  </div>
                  <button
                    onClick={() => startInterview('needs')}
                    style={{
                      padding: '9px 16px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg,#E8601C,#C4511A)',
                      color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 3px 10px rgba(232,96,28,0.25)',
                    }}>
                    ＋ 課題を登録する
                  </button>
                </div>

                {needs.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '48px 24px', background: 'white',
                    borderRadius: 20, border: '2px dashed rgba(196,136,58,0.3)',
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📌</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1806', marginBottom: 6 }}>解決したい課題はありますか？</div>
                    <div style={{ fontSize: 12, color: '#B88860', marginBottom: 20, lineHeight: 1.7 }}>
                      AIが3〜5問で内容を整理します。<br />登録すると、解決できるスキルを持つ人が自動でアプローチしてきます。
                    </div>
                    <button
                      onClick={() => startInterview('needs')}
                      style={{
                        padding: '12px 24px', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg,#E8601C,#C4511A)',
                        color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(232,96,28,0.3)',
                      }}>
                      課題をAIに話す →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {needs.map(n => {
                      const cat = CATEGORY_META[n.category] ?? CATEGORY_META.other
                      return (
                        <div key={n.id} style={{
                          background: 'white', borderRadius: 16, padding: '16px',
                          border: '1px solid rgba(196,136,58,0.18)',
                          boxShadow: '0 2px 12px rgba(196,136,58,0.06)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: '2px 7px', borderRadius: 6 }}>{cat.label}</span>
                                <span style={{ fontSize: 10, color: n.is_public ? '#059669' : '#9CA3AF', background: n.is_public ? '#ECFDF5' : '#F3F4F6', padding: '2px 7px', borderRadius: 6 }}>
                                  {n.is_public ? '🌐 公開' : '🔒 非公開'}
                                </span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#2C1806', marginBottom: 6 }}>{n.title}</div>
                              <div style={{ fontSize: 12, color: '#7A4A28', lineHeight: 1.6, marginBottom: 8 }}>{n.description}</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {n.budget_range !== 'undisclosed' && (
                                  <span style={{ fontSize: 10, color: '#7A4A28', background: '#F0E4D0', padding: '2px 7px', borderRadius: 5 }}>
                                    💰 {BUDGET_LABELS[n.budget_range] ?? n.budget_range}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: URGENCY_COLORS[n.urgency] ?? '#6B7280', background: '#FBF4EC', padding: '2px 7px', borderRadius: 5 }}>
                                  ⏱ {URGENCY_LABELS[n.urgency] ?? n.urgency}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={() => togglePublic(n)}
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(196,136,58,0.3)', background: 'white', color: '#7A4A28', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                {n.is_public ? '非公開に' : '公開する'}
                              </button>
                              <button
                                onClick={() => { if (confirm('この課題を削除しますか？')) deleteNeed(n.id) }}
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => startInterview('needs')}
                      style={{
                        padding: '12px', borderRadius: 12, border: '2px dashed rgba(232,96,28,0.3)',
                        background: 'transparent', color: '#E8601C', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', width: '100%',
                      }}>
                      ＋ 別の課題も登録する
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══ スキルタブ ═══════════════════════════════════ */}
            {tab === 'skills' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#2C1806' }}>得意分野・スキル</div>
                    <div style={{ fontSize: 11, color: '#B88860' }}>登録したスキルをもとに、エージェントが自動で案件を探します</div>
                  </div>
                  <button
                    onClick={() => startInterview('skills')}
                    style={{
                      padding: '9px 16px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)',
                      color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 3px 10px rgba(29,78,216,0.25)',
                    }}>
                    ＋ スキルを登録する
                  </button>
                </div>

                {skills.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '48px 24px', background: 'white',
                    borderRadius: 20, border: '2px dashed rgba(29,78,216,0.2)',
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1806', marginBottom: 6 }}>あなたのスキルを教えてください</div>
                    <div style={{ fontSize: 12, color: '#B88860', marginBottom: 20, lineHeight: 1.7 }}>
                      AIが3〜5問であなたの強みを整理します。<br />登録後すぐ、エージェントが案件を探し始めます。
                    </div>
                    <button
                      onClick={() => startInterview('skills')}
                      style={{
                        padding: '12px 24px', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)',
                        color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(29,78,216,0.25)',
                      }}>
                      強みをAIに話す →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {skills.map(s => {
                      const cat = CATEGORY_META[s.category] ?? CATEGORY_META.other
                      return (
                        <div key={s.id} style={{
                          background: 'white', borderRadius: 16, padding: '16px',
                          border: '1px solid rgba(196,136,58,0.18)',
                          boxShadow: '0 2px 12px rgba(196,136,58,0.06)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: '2px 7px', borderRadius: 6 }}>{cat.label}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#2C1806', marginBottom: 6 }}>{s.title}</div>
                              <div style={{ fontSize: 12, color: '#7A4A28', lineHeight: 1.6, marginBottom: s.achievements ? 8 : 0 }}>{s.description}</div>
                              {s.achievements && (
                                <div style={{ fontSize: 11, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}>
                                  🏆 {s.achievements}
                                </div>
                              )}
                              {s.ideal_client && (
                                <div style={{ fontSize: 11, color: '#7A4A28', background: '#FBF4EC', border: '1px solid rgba(196,136,58,0.2)', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}>
                                  🎯 {s.ideal_client}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => { if (confirm('このスキルを削除しますか？')) deleteSkill(s.id) }}
                              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', fontSize: 10, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', flexShrink: 0 }}>
                              削除
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => startInterview('skills')}
                      style={{
                        padding: '12px', borderRadius: 12, border: '2px dashed rgba(29,78,216,0.25)',
                        background: 'transparent', color: '#1D4ED8', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', width: '100%',
                      }}>
                      ＋ 別のスキルも登録する
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          インタビューモーダル
      ════════════════════════════════════════════════════ */}
      {showInterview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(44,24,6,0.6)',
          zIndex: 200, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(4px)',
        }}>
          {/* ヘッダー */}
          <div style={{
            background: 'white', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: '1px solid rgba(196,136,58,0.15)',
          }}>
            <button
              onClick={() => setShowInterview(false)}
              style={{ background: 'none', border: 'none', color: '#B88860', fontSize: 13, cursor: 'pointer', padding: 0 }}>
              ✕ 閉じる
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#2C1806' }}>
                {interviewType === 'needs' ? '📌 課題をヒアリング' : '💡 スキルをヒアリング'}
              </span>
            </div>
            <div style={{ width: 48 }} />
          </div>

          {/* チャットエリア */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
                    flexShrink: 0, marginRight: 8, alignSelf: 'flex-end',
                    background: '#F0E4D0',
                  }}>
                    <img src="/interviewer.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#E8601C' : 'white',
                  color: msg.role === 'user' ? 'white' : '#2C1806',
                  fontSize: 13, lineHeight: 1.7, fontWeight: msg.role === 'user' ? 600 : 400,
                  boxShadow: '0 2px 8px rgba(44,24,6,0.08)',
                  whiteSpace: 'pre-wrap',
                  // [[SUMMARY]]部分は非表示
                  display: msg.content.includes('[[SUMMARY]]') ? 'none' : 'block',
                }}>
                  {msg.content.replace(/\[\[SUMMARY\]\][\s\S]*\[\[\/SUMMARY\]\]/, '').trim()}
                </div>
              </div>
            ))}

            {/* タイピング中 */}
            {aiTyping && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: '#F0E4D0', flexShrink: 0 }}>
                  <img src="/interviewer.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
                <div style={{ background: 'white', padding: '10px 16px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 2px 8px rgba(44,24,6,0.08)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#C4883A', display: 'inline-block',
                      animation: `bounce 1.2s ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* サマリー確認UI */}
            {summary && !aiTyping && (
              <div style={{
                background: 'white', borderRadius: 16, padding: 20, margin: '8px 0',
                border: '2px solid #E8601C', boxShadow: '0 4px 20px rgba(232,96,28,0.15)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#E8601C', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ✅ 整理できました。内容を確認してください
                </div>
                {[
                  { label: '分野', value: CATEGORY_META[summary.category]?.label ?? summary.category },
                  { label: 'タイトル', value: summary.title },
                  { label: '詳細', value: summary.description },
                  ...(summary.ideal_outcome ? [{ label: '理想のゴール', value: summary.ideal_outcome }] : []),
                  ...(summary.achievements ? [{ label: '実績', value: summary.achievements }] : []),
                  ...(summary.ideal_client ? [{ label: '理想のクライアント', value: summary.ideal_client }] : []),
                  ...(summary.budget_range ? [{ label: '予算感', value: BUDGET_LABELS[summary.budget_range] ?? summary.budget_range }] : []),
                  ...(summary.urgency ? [{ label: '緊急度', value: URGENCY_LABELS[summary.urgency] ?? summary.urgency }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#B88860', letterSpacing: '0.05em' }}>{label}</span>
                    <div style={{ fontSize: 12, color: '#2C1806', marginTop: 2, lineHeight: 1.5 }}>{value}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => { setSummary(null); setMessages([]); sendToAI([]) }}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: '1.5px solid rgba(196,136,58,0.3)', background: 'white', color: '#7A4A28', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    もう一度話す
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      flex: 2, padding: 10, borderRadius: 10, border: 'none',
                      background: saving ? '#F0E4D0' : 'linear-gradient(135deg,#E8601C,#C4511A)',
                      color: saving ? '#B88860' : 'white', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
                      boxShadow: '0 3px 12px rgba(232,96,28,0.3)',
                    }}>
                    {saving ? '保存中...' : 'これで登録する'}
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* 入力エリア */}
          {!summary && (
            <div style={{
              background: 'white', padding: '12px 16px',
              borderTop: '1px solid rgba(196,136,58,0.15)',
              display: 'flex', gap: 10, alignItems: 'flex-end',
            }}>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSend() } }}
                placeholder="メッセージを入力（Shift+Enterで改行）"
                disabled={aiTyping}
                rows={2}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12, resize: 'none',
                  border: '1.5px solid rgba(196,136,58,0.3)', fontSize: 13, color: '#2C1806',
                  background: '#FBF4EC', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleUserSend}
                disabled={!inputText.trim() || aiTyping}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none',
                  background: !inputText.trim() || aiTyping ? '#F0E4D0' : '#E8601C',
                  color: 'white', fontSize: 18, cursor: !inputText.trim() || aiTyping ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                送信
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          アプローチモーダル
      ════════════════════════════════════════════════════ */}
      {approachMatch && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(44,24,6,0.6)',
          zIndex: 200, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'white', borderRadius: '20px 20px 0 0',
            padding: '24px 20px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
            maxWidth: 680, margin: '0 auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#2C1806' }}>提案を送る</div>
              <button onClick={() => setApproachMatch(null)} style={{ background: 'none', border: 'none', color: '#B88860', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            {/* 課題詳細 */}
            <div style={{ background: '#FBF4EC', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#B88860', letterSpacing: '0.08em', marginBottom: 6 }}>相手の課題</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#2C1806', marginBottom: 4 }}>{approachMatch.need_title}</div>
              <div style={{ fontSize: 12, color: '#7A4A28', lineHeight: 1.6, marginBottom: 8 }}>{approachMatch.need_description}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: '#E8601C', fontWeight: 700 }}>適合度 {approachMatch.match_score}点</span>
                <span style={{ fontSize: 10, color: '#7A4A28' }}>·</span>
                <span style={{ fontSize: 10, color: '#7A4A28' }}>{approachMatch.need_user_name} {approachMatch.need_user_company && `/ ${approachMatch.need_user_company}`}</span>
              </div>
            </div>

            {/* メッセージ編集 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#B88860', letterSpacing: '0.05em', marginBottom: 8 }}>
                AIが作ったメッセージ（自由に編集できます）
              </div>
              {genLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#B88860', fontSize: 13 }}>
                  ✨ メッセージを考えています...
                </div>
              ) : (
                <textarea
                  value={approachMsg}
                  onChange={e => setApproachMsg(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, resize: 'vertical',
                    border: '1.5px solid rgba(196,136,58,0.3)', fontSize: 13, color: '#2C1806',
                    background: '#FFFDF9', outline: 'none', fontFamily: 'inherit', lineHeight: 1.7,
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>

            <button
              onClick={sendApproach}
              disabled={sendLoading || genLoading || !approachMsg.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: sendLoading || genLoading || !approachMsg.trim() ? '#F0E4D0' : 'linear-gradient(135deg,#E8601C,#C4511A)',
                color: sendLoading || genLoading || !approachMsg.trim() ? '#B88860' : 'white',
                fontSize: 14, fontWeight: 800, cursor: sendLoading || genLoading ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(232,96,28,0.3)',
              }}>
              {sendLoading ? '送信中...' : '送る'}
            </button>
          </div>
        </div>
      )}

      {/* ── CSS アニメーション ── */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-5px) }
        }
        @keyframes spin {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(232,96,28,0.25) }
          50%       { box-shadow: 0 0 0 6px rgba(232,96,28,0.1) }
        }
      `}</style>
    </div>
  )
}
