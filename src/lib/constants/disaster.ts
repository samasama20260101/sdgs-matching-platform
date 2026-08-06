// 災害SOS(汎用)のイベント定義。
// 新しい災害が起きたら DISASTER_EVENTS に追加し、ACTIVE_DISASTER_EVENT を切り替えるだけで
// バナー表示・専用フォーム・タイル装飾が有効になる。災害が落ち着いたら null に戻す。
// event_id は cases.intake_qna.disaster.event_id として保存される(DBマイグレーション不要)。

export type DisasterEvent = {
  id: string          // intake_qna.disaster.event_id(変更禁止)
  i18nKey: string     // SOS向け表示名: sos.disaster.events.<i18nKey>
  nameJa: string      // サポーター・管理者UI用(日本語固定)
  titlePrefix: string // 案件タイトルの接頭辞
}

export const DISASTER_EVENTS: DisasterEvent[] = [
  { id: 'kumamoto-eq-2026', i18nKey: 'kumamotoEq2026', nameJa: '熊本地震', titlePrefix: '【熊本地震】' },
]

// 現在受付中の災害イベント。null にすると入口バナーとフォームが閉じる。
export const ACTIVE_DISASTER_EVENT: DisasterEvent | null = DISASTER_EVENTS[0]

export const DISASTER_EVENT_IDS = new Set(DISASTER_EVENTS.map((e) => e.id))

export function getDisasterEvent(id: string | null | undefined): DisasterEvent | null {
  return DISASTER_EVENTS.find((e) => e.id === id) ?? null
}

// ─── 災害ニーズ分類(AIが登録後に後追いで付与する注釈) ───
// AIは門番ではなく注釈者: 分類の成否・遅延は案件の公開に一切影響しない。
// タグは cases.intake_qna.disaster.needs.tags に保存される。
// sdgsGoals は将来のインパクト集計用の固定マッピング(AI再分類なしでSDGsに橋を架ける)。

export type DisasterNeedKey =
  | 'housing' | 'water_food' | 'supplies' | 'health'
  | 'mental' | 'family' | 'money_admin' | 'lifeline_info'

export const DISASTER_NEEDS: Record<DisasterNeedKey, { emoji: string; labelJa: string; sdgsGoals: number[] }> = {
  housing: { emoji: '🏠', labelJa: '住まい・避難場所', sdgsGoals: [11] },
  water_food: { emoji: '💧', labelJa: '水・食料', sdgsGoals: [2, 6] },
  supplies: { emoji: '🧰', labelJa: '生活物資', sdgsGoals: [1] },
  health: { emoji: '🏥', labelJa: '医療・健康・介護', sdgsGoals: [3] },
  mental: { emoji: '🫂', labelJa: 'こころ・傾聴', sdgsGoals: [3] },
  family: { emoji: '🧒', labelJa: '子ども・家族', sdgsGoals: [4, 10] },
  money_admin: { emoji: '📄', labelJa: 'お金・手続き', sdgsGoals: [1, 8] },
  lifeline_info: { emoji: '🔌', labelJa: 'ライフライン・情報', sdgsGoals: [9, 11] },
}

export const DISASTER_NEED_KEYS = Object.keys(DISASTER_NEEDS) as DisasterNeedKey[]
export const MAX_DISASTER_NEEDS = 3

export function getDisasterNeeds(intakeQna: unknown): DisasterNeedKey[] {
  const tags = (intakeQna as { disaster?: { needs?: { tags?: unknown } } } | null)?.disaster?.needs?.tags
  if (!Array.isArray(tags)) return []
  return tags
    .filter((tag): tag is DisasterNeedKey => typeof tag === 'string' && tag in DISASTER_NEEDS)
    .slice(0, MAX_DISASTER_NEEDS)
}

// description_free に整形して保存する際の見出し(サポーターが読む想定のため日本語固定)
export const DISASTER_DESCRIPTION_LABELS = {
  situation: '【いま起きていること】',
  since: '【いつから】',
  wish: '【どうなりたいか】',
} as const

export type DisasterAnswers = Partial<Record<keyof typeof DISASTER_DESCRIPTION_LABELS, string>>

export function buildDisasterDescription(answers: DisasterAnswers): string {
  return (Object.keys(DISASTER_DESCRIPTION_LABELS) as Array<keyof typeof DISASTER_DESCRIPTION_LABELS>)
    .filter((key) => (answers[key] ?? '').trim())
    .map((key) => `${DISASTER_DESCRIPTION_LABELS[key]}\n${(answers[key] ?? '').trim()}`)
    .join('\n\n')
}
