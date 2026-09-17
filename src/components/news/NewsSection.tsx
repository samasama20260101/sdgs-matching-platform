'use client';

// トップページの「お知らせ」ブロック。公開中の新しい数件を1行ずつ並べる。
// 公開中が0件・取得失敗のときはブロックごと出さない(空の欄を見せない)。
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { NewsCategoryChip } from '@/components/news/NewsCategoryChip';
import { NEWS_TOP_LIMIT, type NewsPostPublic } from '@/lib/constants/news';
import { formatNewsDate } from '@/lib/news/format';

export function NewsSection() {
  const t = useTranslations('landing.news');
  const locale = useLocale();
  const [posts, setPosts] = useState<NewsPostPublic[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/news?limit=${NEWS_TOP_LIMIT}`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => { if (!cancelled) setPosts(Array.isArray(d?.posts) ? d.posts : []); })
      .catch(() => { /* 取得失敗時は何も出さない */ });
    return () => { cancelled = true; };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="border-b border-gray-100 bg-white px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-gray-700">{t('sectionTitle')}</h2>
          <Link href="/news" className="text-xs text-gray-400 hover:text-teal-600 transition-colors">
            {t('viewAll')} →
          </Link>
        </div>
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {posts.map((post) => {
            const inner = (
              <>
                <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400 sm:w-52">
                  <time dateTime={post.published_at} className="tabular-nums">{formatNewsDate(post.published_at, locale)}</time>
                  <NewsCategoryChip category={post.category} label={t(`category.${post.category}`)} />
                </div>
                <p className="min-w-0 flex-1 text-sm text-gray-800 group-hover:text-teal-700 transition-colors">
                  {post.title}
                  {post.external_url && <span className="ml-1 text-xs text-gray-400">↗</span>}
                </p>
              </>
            );
            const className = 'group flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4';
            return (
              <li key={post.id}>
                {post.external_url ? (
                  <a href={post.external_url} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
                ) : (
                  <Link href={`/news/${post.id}`} className={className}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
