// クライアント・サーバー両方で使えるトーンプリセット定義
// ※ anthropic.ts は OpenAI クライアントを含むためサーバー専用
//   クライアントコンポーネントからはこちらをインポートすること

export const TONE_PRESETS = [
  {
    id: 'formal',
    emoji: '🏛',
    label: 'フォーマル',
    desc: '士業・高級サービス・医療向け',
    value: '非常に丁寧な敬語を徹底する。「〜でございます」「〜いただけますでしょうか」など格調ある表現を使う。絵文字・感嘆符・「！」は一切使わない。馴れ馴れしい言い回しは厳禁。文章は短く簡潔にまとめ、余計な感情表現を加えない。',
  },
  {
    id: 'professional',
    emoji: '💼',
    label: 'プロフェッショナル',
    desc: 'コンサル・BtoB・士業向け',
    value: '丁寧語（です・ます）ベースで話す。論理的で簡潔、信頼感のある口調。馴れ馴れしくしない。絵文字は使わない。感嘆符「！」は控えめに。テンションを上げた言い回しや過度な共感表現は避ける。',
  },
  {
    id: 'natural',
    emoji: '🤝',
    label: 'ナチュラル',
    desc: '多くの業種に合う標準設定',
    value: '丁寧語ベースだが堅すぎない、自然で親しみやすい口調。温かみがある。絵文字は必要なときだけ控えめに使う。過度な明るさやテンションの高さは避ける。',
  },
  {
    id: 'friendly',
    emoji: '😊',
    label: 'フレンドリー',
    desc: '飲食・美容・カジュアル向け',
    value: '明るくカジュアルで親しみやすい口調。絵文字も自然に使う。お客様との距離を縮めることを最優先にする。',
  },
] as const

export type TonePresetId = typeof TONE_PRESETS[number]['id']

/** tone_profile カラムに保存する文字列を生成 */
export function buildToneProfile(presetId: TonePresetId | 'custom', custom: string): string {
  if (presetId === 'custom') return custom.trim()
  return custom.trim() ? `[PRESET:${presetId}]\n${custom.trim()}` : `[PRESET:${presetId}]`
}

/** tone_profile カラムの文字列を presetId + custom に分解 */
export function parseToneProfile(toneProfile: string | null): { presetId: TonePresetId | 'custom'; custom: string } {
  if (!toneProfile) return { presetId: 'natural', custom: '' }
  const match = toneProfile.match(/^\[PRESET:(\w+)\](?:\n([\s\S]*))?$/)
  if (match) {
    const id = match[1] as TonePresetId
    return {
      presetId: TONE_PRESETS.some(p => p.id === id) ? id : 'custom',
      custom: match[2]?.trim() ?? '',
    }
  }
  return { presetId: 'custom', custom: toneProfile }
}

/** プリセットを実際のトーン説明文に展開 */
export function resolveToneText(toneProfile: string | null): string {
  const { presetId, custom } = parseToneProfile(toneProfile)
  const preset = TONE_PRESETS.find(p => p.id === presetId)
  const base = preset?.value ?? custom
  return custom && preset ? `${base}\n\n【追加の口調指示】\n${custom}` : base || '丁寧かつ親しみやすい'
}
