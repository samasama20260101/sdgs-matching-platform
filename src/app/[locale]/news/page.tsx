// お知らせ一覧(公開中のみ)。サーバーで DB を直接読む(設計: docs/news_section_design.md §2.4)。
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { DocShell, DocTitle } from '@/components/app/DocShell'
import { Card, SectionLabel } from '@/components/app/ui'
import { NewsCategoryChip } from '@/components/news/NewsCategoryChip'
import { NEWS_LIST_MAX, NEWS_LIST_PAGE_CAP, type NewsPostPublic } from '@/lib/constants/news'
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

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<{ show?: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing.news' })
  return { title: t('metaTitle') }
}

export default async function NewsListPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'landing.news' })
  // 最初は 50 件。「次の 50 件を見る」で ?show=100, 150… と広げる(古い記事も一覧からたどれるように)
  const requested = Number((await searchParams).show)
  const show = Number.isFinite(requested) && requested > NEWS_LIST_MAX
    ? Math.min(Math.ceil(requested / NEWS_LIST_MAX) * NEWS_LIST_MAX, NEWS_LIST_PAGE_CAP)
    : NEWS_LIST_MAX
  const fetched = await getPublishedNews(show + 1, NEWS_LIST_PAGE_CAP + 1)
  const hasMore = fetched.length > show
  const posts = fetched.slice(0, show)

  return (
    <DocShell jaOnly>
      <DocTitle title={t('listTitle')} note={t('listLead')} />

      {posts.length === 0 ? (
        <Card className="px-4 py-8 text-center text-t13_5 text-mist">{t('empty')}</Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groupByYear(posts, locale).map((group) => (
            <section key={group.year} className="flex flex-col gap-2">
              <SectionLabel>{group.year}</SectionLabel>
              <Card>
                <ul className="m-0 list-none p-0">
                  {group.posts.map((post) => (
                    <li key={post.id} className="border-t border-line first:border-t-0">
                      <Link href={`/news/${post.id}`} className="flex flex-col gap-1.5 px-4 py-3.5 text-ink no-underline hover:bg-kinari-deep">
                        <span className="flex flex-wrap items-center gap-2 text-t12 text-mist">
                          <time dateTime={post.published_at}>{formatNewsDate(post.published_at, locale)}</time>
                          <NewsCategoryChip category={post.category} label={t(`category.${post.category}`)} />
                        </span>
                        <span className="text-t15 font-bold leading-[1.6]">{post.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
          {hasMore && (
            <Link href={`/news?show=${show + NEWS_LIST_MAX}`} scroll={false}
              className="flex min-h-[48px] items-center justify-center rounded-[16px] border-[1.5px] border-line-strong bg-paper px-4 text-t14 font-bold text-ink no-underline">
              {t('more', { count: NEWS_LIST_MAX })}
            </Link>
          )}
        </div>
      )}
    </DocShell>
  )
}
