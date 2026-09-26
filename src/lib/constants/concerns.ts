// お困りごとラベル(括り・項目・ラベル・SDGsヒント)の正本。
// 仕様: 仕様_お困りごとラベル_20260922.html(§3・§7)。
//
// 三層構造:
//   括り(group)  … 相談者が最初に選ぶ入口(5個・複数可・必須)
//   項目(item)   … 括りを選ぶと出てくる本人の言葉(任意・複数可)
//   ラベル(label)… 項目から機械的に決まるサポーター向けの検索単位(8種・番号なし)
// ラベル→SDGs は AI へのヒントと AI 失敗時の既定値であり、正本ではない。
//
// データは cases.intake_qna.concerns / cases.ai_sdg_suggestion.labels_ai に入れる(migration なし)。
// 文言: 相談者向けは i18n(sos.concerns.*)。サポーター・管理者UIは日本語固定なので *Ja をここに持つ。
// 括り・項目・ラベルを増やすときはこのファイルと messages/*/sos.json(6言語)だけを触る。

// 旧フォーム(Q1〜Q5)と新フォームの切替。本番で問題が出たら false に戻す(仕様 §10-8)。
export const CONCERN_FORM_ENABLED = true

// intake_qna.form_version。無い(旧フォーム)案件は concerns 無しとして扱う
export const CONCERN_FORM_VERSION = 2

// AI 補完ラベルの上限(仕様 §6.2)
export const MAX_AI_LABELS = 3

// ─── 括り(入口) ─────────────────────────────────────────────
export type ConcernGroupId = 'living' | 'health' | 'safety' | 'language' | 'unsure'

export const CONCERN_GROUPS: ReadonlyArray<{ id: ConcernGroupId; nameJa: string; emoji: string }> = [
  { id: 'living', nameJa: 'お金・住まい・仕事', emoji: '🏠' },
  { id: 'health', nameJa: 'からだ・こころ', emoji: '🫀' },
  { id: 'safety', nameJa: '暴力・家族・子ども', emoji: '🛡️' },
  { id: 'language', nameJa: 'ことば・在留', emoji: '🌏' },
  { id: 'unsure', nameJa: 'うまく言えない・ひとりで不安', emoji: '💬' },
]

export const CONCERN_GROUP_IDS = CONCERN_GROUPS.map((g) => g.id)

// ─── ラベル(サポーターが探す単位) ──────────────────────────
export type ConcernLabelId =
  | 'money' | 'housing' | 'work' | 'health'
  | 'violence' | 'family' | 'language' | 'alone'

export const CONCERN_LABELS: ReadonlyArray<{ id: ConcernLabelId; nameJa: string; sdgsHint: number[] }> = [
  { id: 'money', nameJa: 'お金・生活費', sdgsHint: [1, 8, 10] },
  { id: 'housing', nameJa: '住まい', sdgsHint: [11, 1, 6, 7] },
  { id: 'work', nameJa: '仕事', sdgsHint: [8, 10] },
  { id: 'health', nameJa: 'からだ・こころ', sdgsHint: [3] },
  { id: 'violence', nameJa: '暴力・いじめ', sdgsHint: [5, 16] },
  { id: 'family', nameJa: '子ども・家族・介護', sdgsHint: [4, 3, 10] },
  { id: 'language', nameJa: 'ことば・在留・差別', sdgsHint: [10, 16] },
  { id: 'alone', nameJa: 'ひとりで不安・話したい', sdgsHint: [3, 11] },
]

export const CONCERN_LABEL_IDS = CONCERN_LABELS.map((l) => l.id)
const LABEL_ORDER = new Map<ConcernLabelId, number>(CONCERN_LABEL_IDS.map((id, i) => [id, i]))
const LABEL_MAP = new Map(CONCERN_LABELS.map((l) => [l.id, l]))

export function getConcernLabel(id: string | null | undefined) {
  return id ? LABEL_MAP.get(id as ConcernLabelId) ?? null : null
}

export function isConcernLabelId(value: unknown): value is ConcernLabelId {
  return typeof value === 'string' && LABEL_MAP.has(value as ConcernLabelId)
}

// ─── 項目(本人がチェックする具体的な言葉) ─────────────────
export type ConcernItemId =
  // お金・住まい・仕事
  | 'food' | 'rent_utility' | 'debt' | 'low_income' | 'welfare_info'
  | 'no_home' | 'eviction' | 'unsafe_home' | 'utilities_off'
  | 'no_job' | 'unpaid' | 'dangerous_job' | 'cannot_work'
  // からだ・こころ
  | 'no_hospital' | 'mental' | 'treatment' | 'addiction'
  // 暴力・家族・子ども
  | 'dv' | 'bullying' | 'stalking' | 'harassment'
  | 'school' | 'childcare' | 'caregiving' | 'young_carer'
  // ことば・在留
  | 'japanese' | 'visa' | 'discrimination' | 'freedom'
  // うまく言えない・ひとりで不安
  | 'no_one' | 'dont_know' | 'isolated' | 'peer'

export type ConcernItem = { id: ConcernItemId; group: ConcernGroupId; nameJa: string; labels: ConcernLabelId[] }

export const CONCERN_ITEMS: ReadonlyArray<ConcernItem> = [
  // お金・住まい・仕事
  { id: 'food', group: 'living', nameJa: '食べ物が十分に買えない', labels: ['money'] },
  { id: 'rent_utility', group: 'living', nameJa: '家賃や光熱費が払えない', labels: ['money', 'housing'] },
  { id: 'debt', group: 'living', nameJa: '借金の返済が苦しい', labels: ['money'] },
  { id: 'low_income', group: 'living', nameJa: '収入が少なく最低限の生活ができない', labels: ['money'] },
  { id: 'welfare_info', group: 'living', nameJa: '生活保護などの制度を知りたい', labels: ['money'] },
  { id: 'no_home', group: 'living', nameJa: '住む場所がない・安全に暮らせる住まいがない', labels: ['housing'] },
  { id: 'eviction', group: 'living', nameJa: '追い出されそう・家賃を滞納している', labels: ['housing', 'money'] },
  { id: 'unsafe_home', group: 'living', nameJa: '家が壊れている・住んでいる場所が危険', labels: ['housing'] },
  { id: 'utilities_off', group: 'living', nameJa: '電気・水道・インターネットが使えない', labels: ['housing'] },
  { id: 'no_job', group: 'living', nameJa: '仕事がない・失いそう', labels: ['work'] },
  { id: 'unpaid', group: 'living', nameJa: '給料が払われない・最低賃金より低い・サービス残業', labels: ['work'] },
  { id: 'dangerous_job', group: 'living', nameJa: 'けがをしそうな危険な職場で働いている', labels: ['work'] },
  { id: 'cannot_work', group: 'living', nameJa: '病気や障害があって働けない・就職活動ができない', labels: ['work', 'health'] },
  // からだ・こころ
  { id: 'no_hospital', group: 'health', nameJa: '体調が悪いが、お金などの理由で病院に行けない', labels: ['health', 'money'] },
  { id: 'mental', group: 'health', nameJa: '眠れない・気持ちが落ち込む・不安が強い', labels: ['health'] },
  { id: 'treatment', group: 'health', nameJa: '薬や治療を続けられない', labels: ['health'] },
  { id: 'addiction', group: 'health', nameJa: 'お酒・ギャンブルなどをやめられない', labels: ['health'] },
  // 暴力・家族・子ども
  { id: 'dv', group: 'safety', nameJa: '家族やパートナーから暴力を受けている', labels: ['violence'] },
  { id: 'bullying', group: 'safety', nameJa: 'いじめや嫌がらせを受けている', labels: ['violence'] },
  { id: 'stalking', group: 'safety', nameJa: 'ストーカー・つきまとい', labels: ['violence'] },
  { id: 'harassment', group: 'safety', nameJa: '職場や学校でハラスメントを受けている', labels: ['violence', 'work'] },
  { id: 'school', group: 'safety', nameJa: '子どもを学校に通わせられない', labels: ['family'] },
  { id: 'childcare', group: 'safety', nameJa: '子どもの食事や世話に困っている', labels: ['family', 'money'] },
  { id: 'caregiving', group: 'safety', nameJa: '家族の介護で自分の生活が回らない', labels: ['family'] },
  { id: 'young_carer', group: 'safety', nameJa: '子どもが働いている・家事や介護を担っている', labels: ['family'] },
  // ことば・在留
  { id: 'japanese', group: 'language', nameJa: '日本語がわからず手続きができない', labels: ['language'] },
  { id: 'visa', group: 'language', nameJa: '在留資格・ビザのことで困っている', labels: ['language'] },
  { id: 'discrimination', group: 'language', nameJa: '外国人であることで差別を受けている', labels: ['language'] },
  { id: 'freedom', group: 'language', nameJa: '宗教や国籍を理由に自由を奪われている', labels: ['language', 'violence'] },
  // うまく言えない・ひとりで不安
  { id: 'no_one', group: 'unsure', nameJa: '相談できる人がいない', labels: ['alone'] },
  { id: 'dont_know', group: 'unsure', nameJa: '何から手をつければいいかわからない', labels: ['alone'] },
  { id: 'isolated', group: 'unsure', nameJa: '家から出られない・人と会えない', labels: ['alone'] },
  { id: 'peer', group: 'unsure', nameJa: '同じ悩みを持つ人と話したい', labels: ['alone'] },
]

const ITEM_MAP = new Map(CONCERN_ITEMS.map((item) => [item.id, item]))
const GROUP_MAP = new Map(CONCERN_GROUPS.map((g) => [g.id, g]))

export function getConcernItem(id: string | null | undefined) {
  return id ? ITEM_MAP.get(id as ConcernItemId) ?? null : null
}

export function getConcernGroup(id: string | null | undefined) {
  return id ? GROUP_MAP.get(id as ConcernGroupId) ?? null : null
}

export function isConcernGroupId(value: unknown): value is ConcernGroupId {
  return typeof value === 'string' && GROUP_MAP.has(value as ConcernGroupId)
}

export function isConcernItemId(value: unknown): value is ConcernItemId {
  return typeof value === 'string' && ITEM_MAP.has(value as ConcernItemId)
}

export function getItemsForGroup(groupId: ConcernGroupId): ConcernItem[] {
  return CONCERN_ITEMS.filter((item) => item.group === groupId)
}

// ─── ほしい助け(旧 Q5・任意) ────────────────────────────────
export type HelpWantedId = 'info' | 'expert' | 'org' | 'peer' | 'listen' | 'paid'

export const HELP_WANTED_OPTIONS: ReadonlyArray<{ id: HelpWantedId; nameJa: string }> = [
  { id: 'info', nameJa: '制度や窓口を教えてほしい' },
  { id: 'expert', nameJa: '専門家(弁護士・医師など)に相談したい' },
  { id: 'org', nameJa: '支援団体につながりたい' },
  { id: 'peer', nameJa: '同じ悩みの人とつながりたい' },
  { id: 'listen', nameJa: '話を聞いてほしい' },
  { id: 'paid', nameJa: '有料でもよいのでサポートを受けたい' },
]

const HELP_MAP = new Map(HELP_WANTED_OPTIONS.map((h) => [h.id, h]))

export function isHelpWantedId(value: unknown): value is HelpWantedId {
  return typeof value === 'string' && HELP_MAP.has(value as HelpWantedId)
}

export function getHelpWanted(id: string | null | undefined) {
  return id ? HELP_MAP.get(id as HelpWantedId) ?? null : null
}

// ─── 計算 ───────────────────────────────────────────────────

// ラベル id の固定順(§3.2)に並べ替える。チップの位置が毎回変わらないようにするため
export function sortLabels(labels: Iterable<ConcernLabelId>): ConcernLabelId[] {
  return [...new Set(labels)].sort((a, b) => (LABEL_ORDER.get(a) ?? 99) - (LABEL_ORDER.get(b) ?? 99))
}

// 項目 → ラベルの和集合(決定的・AI なし)。保存時にサーバーで計算する
export function labelsFromItems(itemIds: Iterable<string>): ConcernLabelId[] {
  const labels: ConcernLabelId[] = []
  for (const id of itemIds) {
    const item = getConcernItem(id)
    if (item) labels.push(...item.labels)
  }
  return sortLabels(labels)
}

// ラベル → SDGs ヒントの和集合(AI 失敗時の既定値)
export function sdgsHintFromLabels(labels: Iterable<ConcernLabelId>): number[] {
  const goals: number[] = []
  for (const id of labels) {
    const label = getConcernLabel(id)
    if (label) for (const g of label.sdgsHint) if (!goals.includes(g)) goals.push(g)
  }
  return goals
}

// ─── 保存形式の読み出し ──────────────────────────────────────
// intake_qna.concerns(仕様 §7)。旧フォーム(form_version 無し)は null を返す
export type CaseConcerns = {
  groups: ConcernGroupId[]
  items: ConcernItemId[]
  labels: ConcernLabelId[]
}

export function getCaseConcerns(intakeQna: unknown): CaseConcerns | null {
  const concerns = (intakeQna as { concerns?: unknown } | null | undefined)?.concerns
  if (!concerns || typeof concerns !== 'object' || Array.isArray(concerns)) return null
  const raw = concerns as { groups?: unknown; items?: unknown; labels?: unknown }
  const groups = Array.isArray(raw.groups) ? raw.groups.filter(isConcernGroupId) : []
  const items = Array.isArray(raw.items) ? raw.items.filter(isConcernItemId) : []
  // labels は保存時に計算済みだが、定数表が変わっても壊れないよう読み出し時も項目から引き直す
  const labels = labelsFromItems(items)
  return { groups, items, labels }
}

export function getHelpWantedIds(intakeQna: unknown): HelpWantedId[] {
  const raw = (intakeQna as { help_wanted?: unknown } | null | undefined)?.help_wanted
  return Array.isArray(raw) ? raw.filter(isHelpWantedId) : []
}

export function getDangerFlag(intakeQna: unknown): boolean {
  return (intakeQna as { danger?: unknown } | null | undefined)?.danger === true
}

// AI 補完ラベル(ai_sdg_suggestion.labels_ai)。本人ラベルと重なる分は除く
export function getAiLabels(aiSuggestion: unknown, ownLabels: Iterable<ConcernLabelId> = []): ConcernLabelId[] {
  const raw = (aiSuggestion as { labels_ai?: unknown } | null | undefined)?.labels_ai
  if (!Array.isArray(raw)) return []
  const own = new Set(ownLabels)
  return sortLabels(raw.filter(isConcernLabelId).filter((id) => !own.has(id))).slice(0, MAX_AI_LABELS)
}

// 一覧・詳細で使う「本人ラベル」と「AI 補完ラベル」の組
export type CaseLabelSet = { own: ConcernLabelId[]; ai: ConcernLabelId[] }

export function getCaseLabelSet(intakeQna: unknown, aiSuggestion: unknown): CaseLabelSet {
  const own = getCaseConcerns(intakeQna)?.labels ?? []
  return { own, ai: getAiLabels(aiSuggestion, own) }
}

// AI プロンプトに渡す本人の選択(日本語の表示名に正規化。仕様 §6.1)
export function describeConcernsJa(intakeQna: unknown): string {
  const concerns = getCaseConcerns(intakeQna)
  if (!concerns) return ''
  const lines: string[] = []
  const groupNames = concerns.groups.map((id) => getConcernGroup(id)?.nameJa).filter(Boolean)
  if (groupNames.length > 0) lines.push(`困っていること(本人が選んだ括り): ${groupNames.join(' / ')}`)
  const itemNames = concerns.items.map((id) => getConcernItem(id)?.nameJa).filter(Boolean)
  if (itemNames.length > 0) lines.push(`当てはまること(本人がチェックした項目):\n${itemNames.map((n) => `- ${n}`).join('\n')}`)
  const helpNames = getHelpWantedIds(intakeQna).map((id) => getHelpWanted(id)?.nameJa).filter(Boolean)
  if (helpNames.length > 0) lines.push(`ほしい助け: ${helpNames.join(' / ')}`)
  if (getDangerFlag(intakeQna)) lines.push('※ 本人が「いますぐ命や身の危険がある」にチェックしています')
  return lines.join('\n')
}
