// リンク先のカードの見た目(公開ページと管理画面のプレビューで共用。データ取得はしない)
import type { LinkPreview } from '@/lib/news/linkPreview'

export function LinkCardView({ preview }: { preview: LinkPreview }) {
  const url = preview.url
  const title = preview.title ?? url
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-tool border border-line bg-paper no-underline transition-colors hover:bg-kinari-deep sm:flex-row"
    >
      {preview.image && (
        <div className="aspect-[1.91/1] w-full shrink-0 bg-kinari-deep sm:aspect-auto sm:w-44">
          {/* eslint-disable-next-line @next/next/no-img-element -- 任意ドメインの OGP 画像。next/image は remotePatterns の事前登録が要るため使わない */}
          <img src={preview.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
        <span className="line-clamp-2 break-all text-[14px] font-bold leading-[1.5] text-ink">{title}</span>
        {preview.description && <span className="line-clamp-2 text-[12.5px] leading-[1.6] text-ink-soft">{preview.description}</span>}
        <span className="mt-1 flex items-center gap-1 text-[11.5px] text-mist">
          <span>{preview.siteName ? `${preview.siteName} · ${preview.hostname}` : preview.hostname}</span>
          <span aria-hidden="true">↗</span>
        </span>
      </div>
    </a>
  )
}
