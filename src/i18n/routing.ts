import { defineRouting } from 'next-intl/routing';

export const locales = ['ja', 'en', 'zh', 'ko', 'vi', 'id'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'ja';

export const localeLabels: Record<AppLocale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '中文',
  ko: '한국어',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export function isAppLocale(locale: string | undefined): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}

export function stripLocalePrefix(pathname: string) {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];

  if (!isAppLocale(maybeLocale)) {
    return pathname;
  }

  const stripped = `/${segments.slice(2).join('/')}`;
  return stripped === '/' ? '/' : stripped.replace(/\/$/, '') || '/';
}
