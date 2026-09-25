// 種別チップ(公開側)。ラベルは呼び出し側が i18n(landing.news.category.*)から渡す。
import { NEWS_CATEGORY_META, type NewsCategory } from '@/lib/constants/news'

export function NewsCategoryChip({ category, label }: { category: NewsCategory; label: string }) {
  const meta = NEWS_CATEGORY_META[category] ?? NEWS_CATEGORY_META.NOTICE
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${meta.chipClass}`}>
      {label}
    </span>
  )
}
