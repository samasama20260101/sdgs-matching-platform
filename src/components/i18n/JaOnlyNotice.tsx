'use client';

// 長文ページ（story / terms / privacy）用:
// 日本語以外のロケールで閲覧しているときに「このページは日本語のみ」の案内を出す。
// 本文の翻訳（法務・広報確認後）が入ったら該当ページからこのバナーを外す。
import { useLocale, useTranslations } from 'next-intl';

export function JaOnlyNotice() {
  const locale = useLocale();
  const t = useTranslations('common');
  if (locale === 'ja') return null;
  return (
    <div className="mx-auto max-w-3xl px-6 pt-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🌐 {t('jaOnlyNotice')}
      </div>
    </div>
  );
}
