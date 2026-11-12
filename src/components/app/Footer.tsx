// 画面の下のリンク(公開ページ)。会社のサイトは別のホストなので素の <a>
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

export function Footer() {
  const t = useTranslations('app.footer')
  const links = [
    { href: '/news', key: 'news' },
    { href: '/story', key: 'story' },
    { href: '/supporters', key: 'supporters' },
    { href: '/contact', key: 'contact' },
    { href: '/terms', key: 'terms' },
    { href: '/privacy', key: 'privacy' },
  ] as const
  return (
    <footer className="mt-8 flex flex-col gap-3 border-t border-line pt-4 text-t12_5 text-mist">
      <nav className="flex flex-wrap gap-x-4 gap-y-2">
        {links.map((l) => <Link key={l.key} href={l.href} className="text-mist">{t(l.key)}</Link>)}
        <a href="https://www.samasama.site" className="text-mist" rel="noopener">{t('company')}</a>
      </nav>
      <span>{t('copyright')}</span>
    </footer>
  )
}
