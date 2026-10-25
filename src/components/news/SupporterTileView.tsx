// 参加団体の記事に出す「サイト内の団体ページ」のタイル(公開ページと管理画面のプレビューで共用。データ取得はしない)
import { getSupporterTypeConfig } from '@/lib/supporterType'
import { type SupporterTileData, yearsSince } from '@/lib/news/supporterTile'

export function SupporterTileView({ data }: { data: SupporterTileData }) {
  const type = data.supporterType ? getSupporterTypeConfig(data.supporterType) : null
  const areas = data.nationwide
    ? '全国'
    : data.areaNames.length > 3 ? `${data.areaNames.slice(0, 3).join('・')} ほか${data.areaNames.length - 3}地域` : data.areaNames.join('・')
  const bio = data.bio?.replace(/\s+/g, ' ').trim()
  return (
    <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {type && <span className={`rounded-full px-2.5 py-1 font-bold ${type.badgeClass}`}>{type.emoji} {type.label}</span>}
        <span className="text-gray-400">登録 {yearsSince(data.createdAt)}年目</span>
      </div>
      <p className="mt-2 text-lg font-black text-gray-900 break-words">{data.name}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        {areas && <span>📍 {areas}</span>}
        <span>✅ 解決 {data.resolvedCount}件</span>
        <span>🏅 {data.badgeCount}</span>
      </div>
      {bio && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">{bio}</p>}
      <div className="mt-4">
        <a href={`/supporters/${data.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-teal-600">
          この団体のページを見る <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}
