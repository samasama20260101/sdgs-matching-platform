// 種別チップ(公開側と管理画面)。ラベルは呼び出し側が渡す(公開側は i18n の landing.news.category.*)
import { Chip } from '@/components/app/ui'
import { NEWS_CATEGORY_META, type NewsCategory } from '@/lib/constants/news'

export function NewsCategoryChip({ category, label }: { category: NewsCategory; label: string }) {
  const meta = NEWS_CATEGORY_META[category] ?? NEWS_CATEGORY_META.NOTICE
  return <Chip color={meta.chip} className="shrink-0">{label}</Chip>
}
