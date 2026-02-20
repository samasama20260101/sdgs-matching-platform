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

// ─── ケースのステータス ─────────────────────────────────────
export const CASE_STATUS = {
    OPEN: { label: 'サポーター待ち', color: 'bg-blue-100 text-blue-600', borderColor: 'border-l-blue-400', icon: '⏳', step: 1 },
    MATCHED: { label: 'マッチ済み', color: 'bg-amber-100 text-amber-600', borderColor: 'border-l-amber-400', icon: '🤝', step: 2 },
    IN_PROGRESS: { label: '対応中', color: 'bg-purple-100 text-purple-600', borderColor: 'border-l-purple-400', icon: '🔄', step: 3 },
    RESOLVED: { label: '解決済み', color: 'bg-green-100 text-green-600', borderColor: 'border-l-green-500', icon: '✅', step: 4 },
    CANCELLED: { label: '取消済み', color: 'bg-gray-100 text-gray-500', borderColor: 'border-l-gray-300', icon: '✕', step: 0 },
    CLOSED: { label: '終了', color: 'bg-gray-100 text-gray-500', borderColor: 'border-l-gray-300', icon: '📁', step: 0 },
} as const;

// ケースステータスのタイプ
export type CaseStatusKey = keyof typeof CASE_STATUS;

// アクティブなステータス（進行中のケースとして扱うもの）
export const ACTIVE_STATUSES: CaseStatusKey[] = ['OPEN', 'MATCHED', 'IN_PROGRESS'];

// 終了済みステータス
export const PAST_STATUSES: CaseStatusKey[] = ['RESOLVED', 'CANCELLED', 'CLOSED'];

// ステータスパイプラインのステップ名
export const STATUS_STEPS = ['待ち', '確認中', '対応中', '解決'] as const;

// ステータス遷移の許可マップ
export const STATUS_TRANSITIONS: Record<string, string[]> = {
    OPEN: ['MATCHED', 'CANCELLED'],
    MATCHED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['RESOLVED', 'CANCELLED'],
    RESOLVED: ['CLOSED'],
    CANCELLED: [],
    CLOSED: [],
};

// ─── サポーターのオファーステータス ─────────────────────────
export const OFFER_STATUS = {
    PENDING: { label: '承認待ち', color: 'bg-amber-50 text-amber-600', icon: '⏳' },
    ACCEPTED: { label: '承認済み', color: 'bg-green-50 text-green-600', icon: '✅' },
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