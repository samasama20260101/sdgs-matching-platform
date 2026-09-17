// お知らせ記事(公開中のみ)。サーバーで DB を直接読み、generateMetadata で記事名を <title> と OGP に出す。
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/icons/Logo'
import { JaOnlyNotice } from '@/components/i18n/JaOnlyNotice'
import { NewsBody } from '@/components/news/NewsBody'
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
  return {
    title: `${post.title} | 明日もsamasama`,
    description,
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      siteName: '明日もsamasama',
      publishedTime: post.published_at,
    },
    twitter: { card: 'summary', title: post.title, description },
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { locale, id } = await params
  const post = await loadPost(id)
  if (!post) notFound()
  const t = await getTranslations({ locale, namespace: 'landing.news' })

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/"><Logo variant="default" size="sm" showText={true} /></Link>
          <Link href="/news" className="text-sm text-gray-400 hover:text-teal-600 transition-colors">{t('backToList')}</Link>
        </div>
      </header>

      <JaOnlyNotice />

      <main className="max-w-3xl mx-auto px-6 py-14">
        <article>
          <div className="mb-8">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <time dateTime={post.published_at}>{formatNewsDate(post.published_at, locale)}</time>
              <NewsCategoryChip category={post.category} label={t(`category.${post.category}`)} />
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-gray-900 leading-snug">{post.title}</h1>
          </div>

          {post.body && <NewsBody body={post.body} />}

          {post.external_url && (
            <div className="mt-10">
              <a
                href={post.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-600"
              >
                {t('external')} <span aria-hidden="true">↗</span>
              </a>
              {/* 飛び先のドメインを添えて、どこへ行くのか分かるようにする(見知らぬサイトへ突然飛ばさない) */}
              <p className="mt-2 text-xs text-gray-400">{t('externalHost', { host: hostnameOf(post.external_url) })}</p>
            </div>
          )}
        </article>

        <div className="mt-14 border-t border-gray-100 pt-6">
          <Link href="/news" className="text-sm text-gray-400 hover:text-teal-600 transition-colors">{t('backToList')}</Link>
        </div>
      </main>
    </div>
  )
}
