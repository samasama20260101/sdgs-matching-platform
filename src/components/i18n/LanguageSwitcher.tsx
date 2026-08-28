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
    sessionStorage.setItem('localeRestored', '1');
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; samesite=lax`;
    router.replace(pathname, { locale: nextLocale });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      return fetch('/api/profile', {
        method: 'POST',
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
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <Languages className="hidden sm:block h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm transition-colors hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
