'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LANGUAGE_SWITCHER_ENABLED, localeLabels, locales, type AppLocale } from '@/i18n/routing';
import { supabase } from '@/lib/supabase/client';

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('common.locale');

  const handleChange = (nextLocale: AppLocale) => {
    if (!LANGUAGE_SWITCHER_ENABLED) return;
    try {
      sessionStorage.setItem('samasama.localeRestored', '1');
    } catch {
      // 保存できなくても切り替えはできる
    }
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; samesite=lax`;
    router.replace(pathname, { locale: nextLocale });

    // ログイン中なら本人の言語として残す(知らせと訳の言語に使う)
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      return fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ locale: nextLocale }),
      });
    }).catch((error) => {
      console.error('[LanguageSwitcher] locale save error:', error);
    });
  };

  if (!LANGUAGE_SWITCHER_ENABLED) return null;

  return (
    <label className="inline-flex items-center gap-1.5 text-[13px] text-mist">
      <Languages className="hidden sm:block h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
        className="min-h-[36px] rounded-tool border border-line-strong bg-paper px-2 text-[13px] text-ink focus:border-night focus:outline-none"
        aria-label={t('label')}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {localeLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
