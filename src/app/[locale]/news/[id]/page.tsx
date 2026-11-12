// お知らせ記事(公開中のみ)。サーバーで DB を直接読み、generateMetadata で記事名を <title> と OGP に出す。
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { DocShell } from '@/components/app/DocShell'
import { Heading } from '@/components/app/ui'
import { NewsBody } from '@/components/news/NewsBody'
import { LinkPreviewCard } from '@/components/news/LinkPreviewCard'
import { NewsCategoryChip } from '@/components/news/NewsCategoryChip'
import { isUuid } from '@/lib/api/validation'
import { formatNewsDate } from '@/lib/news/format'
import { getPublishedNewsById } from '@/lib/news/queries'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ locale: string; id: string }> }

// generateMetadata と本体で同じ id を二度読まないようにリクエスト内でキャッシュする
const loadPost = cache(async (id: string) => (isUuid(id) ? getPublishedNewsById(id) : null))

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function summarize(body: string) {
  return body.replace(/^## .*$/gm, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'landing.news' })
  const post = await loadPost(id)
  if (!post) return { title: t('metaTitle'), robots: { index: false, follow: false } }
  const description = summarize(post.body) || undefined
  // タイトル入りの共有用画像。更新日時を付けて、タイトルを直したら別の画像として読み直されるようにする
  const image = {
    url: `/api/public/news/${post.id}/og?v=${new Date(post.updated_at).getTime()}`,
    width: 1200,
    height: 630,
    alt: post.title,
  }
  return {
    title: `${post.title} | 明日もsamasama`,
    description,
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      siteName: '明日もsamasama',
      publishedTime: post.published_at,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: post.title, description, images: [image] },
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { locale, id } = await params
  const post = await loadPost(id)
  if (!post) notFound()
  const t = await getTranslations({ locale, namespace: 'landing.news' })

  return (
    <DocShell jaOnly>
      <Link href="/news" className="flex min-h-[40px] items-center self-start text-[13px] text-night">{t('backToList')}</Link>
      <article className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 px-1">
          <span className="flex flex-wrap items-center gap-2 text-[12px] text-mist">
            <time dateTime={post.published_at}>{formatNewsDate(post.published_at, locale)}</time>
            <NewsCategoryChip category={post.category} label={t(`category.${post.category}`)} />
          </span>
          <Heading className="wrap-anywhere">{post.title}</Heading>
        </div>

        {post.body && <NewsBody body={post.body} />}

        {post.external_url && (
          <div className="flex flex-col gap-3">
            {/* 飛び先の OGP カード(画像・タイトル)を先に見せて、ボタンで外へ出る */}
            <LinkPreviewCard url={post.external_url} />
            <a
              href={post.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-night px-4 text-[15px] font-bold tracking-[0.1em] text-white no-underline"
            >
              {t('external')} <span aria-hidden="true">↗</span>
            </a>
            {/* 飛び先のドメインを添えて、どこへ行くのか分かるようにする(見知らぬサイトへ突然飛ばさない) */}
            <span className="px-1 text-[12px] text-mist">{t('externalHost', { host: hostnameOf(post.external_url) })}</span>
          </div>
        )}
      </article>
    </DocShell>
  )
}
