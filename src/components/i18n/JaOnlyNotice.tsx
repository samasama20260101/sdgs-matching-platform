'use client';

// 長文ページ(お知らせ・ストーリー・規約・プライバシー)用:
// 日本語以外のロケールで閲覧しているときに「このページは日本語のみ」の案内を出す。
// 本文の翻訳(法務・広報確認後)が入ったら該当ページからこのバナーを外す。
import { useLocale, useTranslations } from 'next-intl';

export function JaOnlyNotice() {
  const locale = useLocale();
  const t = useTranslations('common');
  if (locale === 'ja') return null;
  return <p className="m-0 rounded-tool bg-lamp-faint px-3 py-2 text-[13px] leading-[1.7] text-ink-soft">{t('jaOnlyNotice')}</p>;
}
