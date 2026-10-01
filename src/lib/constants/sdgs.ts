// ─── SDGsゴールの色 ─────────────────────────────────────────
export const SDG_COLORS: Record<number, string> = {
    1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d',
    5: '#ff3a21', 6: '#26bde2', 7: '#fcc30b', 8: '#a21942',
    9: '#fd6925', 10: '#dd1367', 11: '#fd9d24', 12: '#bf8b2e',
    13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 16: '#00689d',
    17: '#19486a',
};

// ─── SDGsゴールの名前 ───────────────────────────────────────
export const SDG_NAMES: Record<number, string> = {
    1: '貧困をなくそう', 2: '飢餓をゼロに', 3: 'すべての人に健康と福祉を',
    4: '質の高い教育をみんなに', 5: 'ジェンダー平等を実現しよう',
    6: '安全な水とトイレを世界中に', 7: 'エネルギーをみんなにそしてクリーンに',
    8: '働きがいも経済成長も', 9: '産業と技術革新の基盤をつくろう',
    10: '人や国の不平等をなくそう', 11: '住み続けられるまちづくりを',
    12: 'つくる責任つかう責任', 13: '気候変動に具体的な対策を',
    14: '海の豊かさを守ろう', 15: '陸の豊かさも守ろう',
    16: '平和と公正をすべての人に', 17: 'パートナーシップで目標を達成しよう',
};

// ─── SDGsゴールの「言葉」ラベル(サポーター向け・日本語固定) ──────
// サポーターから「SDGs 11 って何?」と指摘されたため、一覧のフィルターとバッジ・案件詳細では
// 番号ではなくこの言葉を出す(2026-09-30 決定)。AI の分類(1〜17)と SDGs の色はそのまま使う。
// 言葉は「サポーターが案件を探すときの語」に寄せてあり、国際目標の正式名は SDG_NAMES に残す。
// 相談として来ることの少ないゴール(6・7・9・12〜17)も、AI が付けたときに番号だけにならないよう全 17 個を用意する。
export const SDG_WORD_LABELS: Record<number, string> = {
    1: 'お金・生活費',
    2: '食べ物',
    3: 'からだ・こころ',
    4: '学校・学び',
    5: '性別による困りごと・DV',
    6: '水・トイレ',
    7: '電気・エネルギー',
    8: '仕事・収入',
    9: '通信・インフラ',
    10: '差別・不平等',
    11: '住まい・地域',
    12: 'ごみ・くらしの資源',
    13: '気候・災害',
    14: '海・漁業',
    15: '森・農地',
    16: '暴力・法律・手続き',
    17: '団体どうしの連携',
};

export function sdgWordLabel(goal: number): string {
    return SDG_WORD_LABELS[goal] ?? `SDG ${goal}`;
}

// ─── サポーター上限（この値を変えるだけで全体に反映される） ──────
// 通常・災害とも1案件1団体制。2団体目以降は将来「マッチ済みサポーターによる招待」方式で入れる予定のため、並列マッチングは開かない
export const MAX_SUPPORTERS_PER_CASE = 1

// ─── ケースのステータス ─────────────────────────────────────
export const CASE_STATUS = {
    OPEN: { label: 'サポーター待ち', color: 'bg-blue-100 text-blue-600', borderColor: 'border-l-blue-400', icon: '⏳', step: 1 },
    MATCHED: { label: 'マッチ済み・支援中', color: 'bg-amber-100 text-amber-600', borderColor: 'border-l-amber-400', icon: '🤝', step: 2 },
    RESOLVED: { label: '解決済み', color: 'bg-teal-50 text-teal-600', borderColor: 'border-l-green-500', icon: '✅', step: 3 },
    CANCELLED: { label: '取消済み', color: 'bg-gray-100 text-gray-500', borderColor: 'border-l-gray-300', icon: '✕', step: 0 },
    CLOSED: { label: '終了', color: 'bg-gray-100 text-gray-500', borderColor: 'border-l-gray-300', icon: '📁', step: 0 },
} as const;

// ケースステータスのタイプ
export type CaseStatusKey = keyof typeof CASE_STATUS;

// アクティブなステータス（進行中のケースとして扱うもの）
export const ACTIVE_STATUSES: CaseStatusKey[] = ['OPEN', 'MATCHED'];

// 終了済みステータス
export const PAST_STATUSES: CaseStatusKey[] = ['RESOLVED', 'CANCELLED', 'CLOSED'];

// ステータスパイプラインのステップ名
export const STATUS_STEPS = ['待ち', 'マッチ済み', '解決報告', '解決'] as const;

// ステータス遷移の許可マップ
export const STATUS_TRANSITIONS: Record<string, string[]> = {
    OPEN: ['MATCHED', 'CANCELLED'],
    MATCHED: ['RESOLVED', 'CANCELLED'],
    RESOLVED: ['CLOSED'],
    CANCELLED: [],
    CLOSED: [],
};

// ─── サポーターのオファーステータス ─────────────────────────
export const OFFER_STATUS = {
    PENDING: { label: '承認待ち', color: 'bg-amber-50 text-amber-600', icon: '⏳' },
    ACCEPTED: { label: '承認済み', color: 'bg-teal-50 text-teal-600', icon: '✅' },
    DECLINED: { label: '辞退', color: 'bg-gray-100 text-gray-500', icon: '✕' },
    WITHDRAWN: { label: '取り下げ済', color: 'bg-gray-100 text-gray-500', icon: '↩' },
} as const;

// ─── 地方ブロック定義 ───────────────────────────────────────
export const REGION_BLOCKS: Record<string, string[]> = {
    '北海道・東北': ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
    '関東': ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県'],
    '中部': ['愛知県', '静岡県', '新潟県', '長野県', '岐阜県', '富山県', '石川県', '福井県', '山梨県'],
    '関西': ['大阪府', '京都府', '兵庫県', '奈良県', '滋賀県', '和歌山県', '三重県'],
    '中国・四国': ['広島県', '岡山県', '山口県', '鳥取県', '島根県', '香川県', '愛媛県', '徳島県', '高知県'],
    '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
};

// ─── 日付フォーマット ───────────────────────────────────────
export function formatRelativeDate(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今日';
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
    return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
}

// ─── 日付フォーマット（多言語対応版） ───────────────────────
// 移行済み（i18n対応済み）画面はこちらを使う。localeは next-intl の useLocale() から渡す。
// 旧 formatRelativeDate は未移行のサポーター画面用に残している（Phase 3 で統合予定）。
export function formatRelativeDateIntl(dateStr: string, locale: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffDays <= 0) return rtf.format(0, 'day');
    if (diffDays === 1) return rtf.format(-1, 'day');
    if (diffDays < 7) return rtf.format(-diffDays, 'day');
    if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), 'week');
    return date.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
}

// ─── サポーター評価バッジ ─────────────────────────────────────
export const SUPPORTER_BADGES = {
    gold_medal: { emoji: '🥇', label: 'ありがとう（主）', auto: true },
    silver_medal: { emoji: '🥈', label: 'ありがとう（副）', auto: true },
    very_satisfied: { emoji: '😆', label: '大満足' },
    quick_response: { emoji: '⚡', label: '迅速な対応' },
    sincere_support: { emoji: '💎', label: '誠実なサポート' },
    problem_solved: { emoji: '🌟', label: 'あきらめていた問題が解決' },
    grateful_partner: { emoji: '🤝', label: '一緒に向き合い大感謝' },
} as const;

export type BadgeKey = keyof typeof SUPPORTER_BADGES;

// SOSユーザーが選択可能なバッジ（auto を除く）
export const SELECTABLE_BADGES: BadgeKey[] = [
    'very_satisfied', 'quick_response', 'sincere_support', 'problem_solved', 'grateful_partner',
];