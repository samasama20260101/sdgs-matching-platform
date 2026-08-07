// 災害SOS(汎用)のイベント定義。
// 新しい災害が起きたら DISASTER_EVENTS に追加し、ACTIVE_DISASTER_EVENT を切り替えるだけで
// バナー表示・専用フォーム・タイル装飾が有効になる。災害が落ち着いたら null に戻す。
// event_id は cases.intake_qna.disaster.event_id として保存される(DBマイグレーション不要)。

// 地域のローカル区分(市町村ごとの独自区分)。
// 呼び名(label)ごと設定値: 八代市は「校区」、別の市は「地区」「町内会」等でもよい。
// 共通の地域マスタ(regions)には混ぜない — 標準コードのない自治体独自区分は
// 災害イベントに従属させ、イベント終了とともに消せるようにする。
export type DisasterLocalAreas = { label: string; options: string[] }

export type DisasterEvent = {
  id: string          // intake_qna.disaster.event_id(変更禁止)
  i18nKey: string     // SOS向け表示名: sos.disaster.events.<i18nKey>
  nameJa: string      // サポーター・管理者UI用(日本語固定)
  titlePrefix: string // 案件タイトルの接頭辞
  municipalities?: string[]                       // 対象市町村(選択肢。任意入力)
  localAreas?: Record<string, DisasterLocalAreas> // 市町村ごとの独自区分(エントリがある市のみ二段目を表示)
}

// 熊本県の45市町村(JISコード順)
const KUMAMOTO_MUNICIPALITIES = [
  '熊本市', '八代市', '人吉市', '荒尾市', '水俣市', '玉名市', '山鹿市', '菊池市',
  '宇土市', '上天草市', '宇城市', '阿蘇市', '天草市', '合志市',
  '美里町', '玉東町', '南関町', '長洲町', '和水町', '大津町', '菊陽町',
  '南小国町', '小国町', '産山村', '高森町', '西原村', '南阿蘇村',
  '御船町', '嘉島町', '益城町', '甲佐町', '山都町', '氷川町',
  '芦北町', '津奈木町', '錦町', '多良木町', '湯前町', '水上村', '相良村',
  '五木村', '山江村', '球磨村', 'あさぎり町', '苓北町',
]

// 八代市の校区20(出典: やつしろあったかねっと koukusearch。「郡築」の表記は市に最終確認中)
const YATSUSHIRO_SCHOOL_DISTRICTS = [
  '代陽', '太田郷', '植柳', '松高', '八代', '麦島', '八千把', '高田', '金剛', '郡築',
  '昭和', '宮地', '龍峯', '日奈久', '二見', '坂本', '千丁', '鏡', '東陽', '泉',
]

export const DISASTER_EVENTS: DisasterEvent[] = [
  {
    id: 'kumamoto-eq-2026',
    i18nKey: 'kumamotoEq2026',
    nameJa: '熊本地震',
    titlePrefix: '【熊本地震】',
    municipalities: KUMAMOTO_MUNICIPALITIES,
    localAreas: {
      '八代市': { label: '校区', options: YATSUSHIRO_SCHOOL_DISTRICTS },
    },
  },
]

// 現在受付中の災害イベント。null にすると入口バナーとフォームが閉じる。
export const ACTIVE_DISASTER_EVENT: DisasterEvent | null = DISASTER_EVENTS[0]

export const DISASTER_EVENT_IDS = new Set(DISASTER_EVENTS.map((e) => e.id))

export type DisasterLocation = { municipality?: string; area?: string }

export function getDisasterLocation(intakeQna: unknown): DisasterLocation | null {
  const location = (intakeQna as { disaster?: { location?: unknown } } | null)?.disaster?.location
  if (!location || typeof location !== 'object' || Array.isArray(location)) return null
  const municipality = (location as DisasterLocation).municipality
  const area = (location as DisasterLocation).area
  if (typeof municipality !== 'string' || !municipality) return null
  return {
    municipality,
    ...(typeof area === 'string' && area ? { area } : {}),
  }
}

// サポーター・管理者UI向けの表示文字列(例: 八代市・代陽校区)
export function formatDisasterLocation(eventId: string | null | undefined, location: DisasterLocation | null): string | null {
  if (!location) return null
  const event = getDisasterEvent(eventId)
  const areaLabel = location.area && event?.localAreas?.[location.municipality ?? '']?.label
  return location.area
    ? `${location.municipality}・${location.area}${areaLabel ?? ''}`
    : `${location.municipality}`
}

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
