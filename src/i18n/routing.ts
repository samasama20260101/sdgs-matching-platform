import { defineRouting } from 'next-intl/routing';

// 翻訳カタログ（messages/）・DBのCHECK制約に存在する全ロケール。
// ko / vi / id はネイティブ確認が完了するまで非公開（カタログとDB定義は保持）。
export const allLocales = ['ja', 'en', 'zh', 'ko', 'vi', 'id'] as const;

export type SupportedLocale = (typeof allLocales)[number];

// 現在ユーザーに公開しているロケール。公開拡大時はここに追加するだけでよい。
export const locales = ['ja', 'en', 'zh'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'ja';

// 多言語はまだ一般公開しない（後日大々的に公開予定）。公開時に true へ戻す。
// 言語選択UIはヘッダーの LanguageSwitcher とプロフィールの表示言語欄の2箇所にあり、
// どちらもこの1つのフラグで出し分ける（片方だけ戻す事故を防ぐため）。
export const LANGUAGE_SWITCHER_ENABLED = false;

export const localeLabels: Record<SupportedLocale, string> = {
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
  // 多言語の大々的公開までブラウザ言語による自動リダイレクトを止める(ja固定)。
  // 公開時はこの行を削除し、上の LANGUAGE_SWITCHER_ENABLED も true へ。
  localeDetection: false,
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
