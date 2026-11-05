// v1 の「ありがとう」のバッジ(公開の団体ページ /supporters/[id] に出す数)。言葉は messages の sdgs.badge
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
