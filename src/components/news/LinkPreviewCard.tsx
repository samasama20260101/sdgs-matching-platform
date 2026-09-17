// リンク先の OGP カード(サーバーコンポーネント)。画像・タイトル・説明・ドメインを見せて、
// 「どこへ飛ぶのか」が分かる状態で外部へ出す。取れなければドメインと URL だけのカード。
import { fetchLinkPreview } from '@/lib/news/linkPreview'

export async function LinkPreviewCard({ url }: { url: string }) {
  const preview = await fetchLinkPreview(url)
  const title = preview.title ?? url
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white no-underline transition-colors hover:border-teal-300 hover:bg-teal-50/40 sm:flex-row"
    >
      {preview.image && (
        <div className="aspect-[1.91/1] w-full shrink-0 bg-gray-100 sm:aspect-auto sm:w-44">
          {/* eslint-disable-next-line @next/next/no-img-element -- 任意ドメインの OGP 画像。next/image は remotePatterns の事前登録が要るため使わない */}
          <img src={preview.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 group-hover:text-teal-700 break-all">{title}</p>
        {preview.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{preview.description}</p>}
        <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
          <span>{preview.siteName ? `${preview.siteName} · ${preview.hostname}` : preview.hostname}</span>
          <span aria-hidden="true">↗</span>
        </p>
      </div>
    </a>
  )
}
