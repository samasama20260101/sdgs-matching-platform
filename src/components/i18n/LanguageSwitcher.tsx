'use client';

// 言語の切り替え。ヘッダーには翻訳の印だけを出し、押すとそれぞれの言語で書いた名前の一覧が開く
// (どの言語の人にも同じ印で見つけられ、選ぶときは自分の言語の名前で選べる)。
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeLabels, locales, type AppLocale } from '@/i18n/routing';
import { rememberChosenLocale } from '@/lib/client/locale';
import { supabase } from '@/lib/supabase/client';

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('common.locale');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // 外を押す・Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleChange = (nextLocale: AppLocale) => {
    setOpen(false);
    if (nextLocale === locale) return;
    rememberChosenLocale(nextLocale);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${t('label')}: ${localeLabels[locale]}`}
        title={t('label')}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-steel focus-visible:outline-2 focus-visible:outline-night"
      >
        <Languages className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={listId}
          aria-label={t('label')}
          className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-tool border border-line bg-paper py-1"
        >
          {locales.map((option) => (
            <li key={option}>
              <button
                type="button"
                lang={option}
                aria-current={option === locale ? 'true' : undefined}
                onClick={() => handleChange(option)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 text-left text-t14 text-ink hover:bg-steel focus-visible:bg-steel focus-visible:outline-none"
              >
                <span className={option === locale ? 'font-bold' : undefined}>{localeLabels[option]}</span>
                {option === locale && <Check className="h-4 w-4 text-night" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
