import { defineRouting } from 'next-intl/routing';

// 翻訳カタログ（messages/）・DBのCHECK制約に存在する全ロケール。
// v2.0 で公開するのは ja・en・es(11/5 定例。中国語は入れない)。zh / ko / vi / id はカタログとDB定義だけ残す。
export const allLocales = ['ja', 'en', 'es', 'zh', 'ko', 'vi', 'id'] as const;

export type SupportedLocale = (typeof allLocales)[number];

// 現在ユーザーに公開しているロケール。公開拡大時はここに追加するだけでよい。
export const locales = ['ja', 'en', 'es'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'ja';

// v2.0 で世界中からの相談と支援への参加を受けるので、言語の切り替えを出す(11/5 定例)。
export const LANGUAGE_SWITCHER_ENABLED = true;

export const localeLabels: Record<SupportedLocale, string> = {
  ja: '日本語',
  en: 'English',
  es: 'Español',
  zh: '中文',
  ko: '한국어',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // 初めて来た人はブラウザの言語に合わせる(ja・en・es のどれでもなければ ja)。選んだ言語は cookie に残る
  localeDetection: true,
});

export function isAppLocale(locale: string | undefined): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}

// ハードリロード（window.location.href）時にロケールを維持するためのパス生成。
// 通常の遷移は @/i18n/navigation の Link / useRouter を使うこと。
export function withLocalePath(locale: string, path: string) {
  return locale === defaultLocale || !isAppLocale(locale) ? path : `/${locale}${path}`;
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
