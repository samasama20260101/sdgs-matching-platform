// 参加団体の記事に出す「サイト内の団体ページ」のタイル(公開ページと管理画面のプレビューで共用。データ取得はしない)
import { Chip } from '@/components/app/ui'
import { joinedSinceJa, SUPPORTER_TYPE_LABEL_JA, type SupporterTileData } from '@/lib/news/supporterTile'

export function SupporterTileView({ data }: { data: SupporterTileData }) {
  const type = data.supporterType ? SUPPORTER_TYPE_LABEL_JA[data.supporterType] ?? data.supporterType : null
  const areas = data.nationwide
    ? '全国'
    : data.areaNames.length > 3 ? `${data.areaNames.slice(0, 3).join('・')} ほか${data.areaNames.length - 3}地域` : data.areaNames.join('・')
  const bio = data.bio?.replace(/\s+/g, ' ').trim()
  return (
    <div className="flex flex-col gap-2.5 rounded-soft border border-line bg-paper p-4">
      <span className="flex flex-wrap items-center gap-1.5">
        {type && <Chip>{type}</Chip>}
        <span className="text-[12px] text-mist">{joinedSinceJa(data.createdAt)}</span>
      </span>
      <span className="wrap-anywhere font-heading text-[17px] font-bold leading-[1.5] text-ink">{data.name}</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-soft">
        {areas && <span>{areas}</span>}
        <span>解決 {data.resolvedCount}件</span>
        <span>ありがとう {data.badgeCount}</span>
      </span>
      {bio && <p className="m-0 line-clamp-2 text-[13px] leading-[1.7] text-ink-soft">{bio}</p>}
      <a href={`/supporters/${data.id}`} className="flex min-h-[44px] items-center justify-center rounded-[14px] bg-night px-4 text-[14px] font-bold text-white no-underline">
        この団体のページを見る
      </a>
    </div>
  )
}
