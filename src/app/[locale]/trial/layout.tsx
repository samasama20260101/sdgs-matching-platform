// 体験ページの共有時の表示(OGP)。LINE などでリンクを送ったとき、
// サイト全体の説明ではなく「登録なしで相談フォームを試せる」と出るようにする
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { isAppLocale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isAppLocale(locale) ? locale : 'ja', namespace: 'sos.trial' });
  const title = `${t('title')} | 明日もsamasama`;
  const description = t('subtitle');
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: '明日もsamasama',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '明日もsamasama - SDGs Match Platform' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
  };
}

export default function TrialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
