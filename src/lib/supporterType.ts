// サポータータイプのラベル・絵文字・色を一元管理
export type SupporterType = 'NPO' | 'CORPORATE' | 'GOVERNMENT'

export const SUPPORTER_TYPE_CONFIG: Record<SupporterType, {
  emoji: string
  label: string
  badgeClass: string
  textClass: string
}> = {
  NPO: {
    emoji: '🌿',
    label: 'NPO / 支援団体',
    badgeClass: 'bg-blue-100 text-blue-700',
    textClass: 'text-blue-600',
  },
  CORPORATE: {
    emoji: '🏢',
    label: '企業',
    badgeClass: 'bg-orange-100 text-orange-700',
    textClass: 'text-orange-600',
  },
  GOVERNMENT: {
    emoji: '🏛️',
    label: '行政・公共機関',
    badgeClass: 'bg-purple-100 text-purple-700',
    textClass: 'text-purple-600',
  },
}

export function getSupporterTypeConfig(type: string) {
  return SUPPORTER_TYPE_CONFIG[type as SupporterType] ?? {
    emoji: '🌿',
    label: type,
    badgeClass: 'bg-gray-100 text-gray-700',
    textClass: 'text-gray-600',
  }
}
