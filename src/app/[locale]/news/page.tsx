// お知らせ一覧(公開中のみ)。サーバーで DB を直接読む(設計: docs/news_section_design.md §3.4)。
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/icons/Logo'
import { JaOnlyNotice } from '@/components/i18n/JaOnlyNotice'
import { NewsCategoryChip } from '@/components/news/NewsCategoryChip'
import { NEWS_LIST_MAX, type NewsPostPublic } from '@/lib/constants/news'
import { formatNewsDate, formatNewsYear } from '@/lib/news/format'
import { getPublishedNews } from '@/lib/news/queries'

export const dynamic = 'force-dynamic'

// 公開日(日本時間)の年でまとめる。入力は新しい順なので、年も新しい順に並ぶ
function groupByYear(posts: NewsPostPublic[], locale: string) {
  const groups: { year: string; posts: NewsPostPublic[] }[] = []
  for (const post of posts) {
    const year = formatNewsYear(post.published_at, locale)
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.posts.push(post)
    else groups.push({ year, posts: [post] })
  }
  return groups
}

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing.news' })
  return { title: t('metaTitle') }
}

export default async function NewsListPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing.news' })
  const posts = await getPublishedNews(NEWS_LIST_MAX)

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/"><Logo variant="default" size="sm" showText={true} /></Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-teal-600 transition-colors">{t('backToTop')}</Link>
        </div>
      </header>

      <JaOnlyNotice />

      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-10">
          <p className="text-xs text-teal-600 font-mono tracking-[4px] uppercase mb-3">{t('listKicker')}</p>
          <h1 className="text-3xl font-black text-gray-900 mb-3">{t('listTitle')}</h1>
          <p className="text-sm text-gray-500 leading-relaxed">{t('listLead')}</p>
        </div>

        {posts.length === 0 ? (
          <p className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">{t('empty')}</p>
        ) : (
          <div className="space-y-12">
            {groupByYear(posts, locale).map((group) => (
              <section key={group.year}>
                <h2 className="mb-2 text-xs font-mono tracking-[3px] text-teal-600">{group.year}</h2>
                <ul className="divide-y divide-gray-100 border-y border-gray-100">
                  {group.posts.map((post) => {
                    const inner = (
                      <>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <time dateTime={post.published_at}>{formatNewsDate(post.published_at, locale)}</time>
                          <NewsCategoryChip category={post.category} label={t(`category.${post.category}`)} />
                        </div>
                        <p className="mt-1.5 text-base font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                          {post.title}
                          {post.external_url && <span className="ml-1.5 text-xs font-normal text-gray-400">↗</span>}
                        </p>
                      </>
                    )
                    return (
                      <li key={post.id}>
                        {post.external_url ? (
                          <a href={post.external_url} target="_blank" rel="noopener noreferrer" className="group block py-5">
                            {inner}
                          </a>
                        ) : (
                          <Link href={`/news/${post.id}`} className="group block py-5">
                            {inner}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
