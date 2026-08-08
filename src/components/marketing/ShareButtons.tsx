// SNSシェアボタン（トップページ用）
// SDKは読み込まず、各SNSのシェアインテントURLを新規ウィンドウで開くだけの軽量実装。
'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

function openShare(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=560');
}

export function ShareButtons() {
  const t = useTranslations('landing.share');
  const [copied, setCopied] = useState(false);

  // シェアURLはクリック時に取得（表示中ロケールのトップをそのまま共有する）
  const pageUrl = () => window.location.href;

  const shareX = () => {
    const params = new URLSearchParams({
      text: t('text'),
      url: pageUrl(),
      hashtags: '明日もsamasama',
    });
    openShare(`https://twitter.com/intent/tweet?${params.toString()}`);
  };

  const shareLine = () => {
    openShare(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl())}`);
  };

  const shareFacebook = () => {
    openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl())}`);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボード不可の環境では何もしない
    }
  };

  const buttonClass =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  return (
    <div className="mt-10 border-t border-white/20 pt-6">
      <p className="mb-4 text-sm font-semibold text-teal-100">{t('label')}</p>
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={shareX} className={buttonClass} aria-label={t('shareOn', { network: 'X' })} title="X">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
          </svg>
        </button>
        <button type="button" onClick={shareLine} className={buttonClass} aria-label={t('shareOn', { network: 'LINE' })} title="LINE">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c-5.52 0-10 3.63-10 8.1 0 4.01 3.56 7.37 8.37 8-.32.14-.55 1.04-.6 1.5-.06.56.23.55.5.4.21-.12 3.36-2.28 4.72-3.28 4.05-.6 7.01-3.6 7.01-6.62 0-4.47-4.48-8.1-10-8.1Zm-5.1 10.62H4.98a.53.53 0 0 1-.53-.53V9.16a.53.53 0 1 1 1.06 0v2.9h1.39a.53.53 0 1 1 0 1.06Zm2.02-.53a.53.53 0 1 1-1.06 0V9.16a.53.53 0 1 1 1.06 0v3.43Zm4.6 0a.53.53 0 0 1-.96.31l-1.79-2.44v2.13a.53.53 0 1 1-1.06 0V9.16a.53.53 0 0 1 .96-.31l1.79 2.44V9.16a.53.53 0 1 1 1.06 0v3.43Zm3.5-2.25a.53.53 0 1 1 0 1.06h-1.39v.66h1.39a.53.53 0 1 1 0 1.06h-1.92a.53.53 0 0 1-.53-.53V9.16c0-.29.24-.53.53-.53h1.92a.53.53 0 1 1 0 1.06h-1.39v.65h1.39Z" />
          </svg>
        </button>
        <button type="button" onClick={shareFacebook} className={buttonClass} aria-label={t('shareOn', { network: 'Facebook' })} title="Facebook">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M13.5 21.9v-8.4h2.82l.42-3.27H13.5V8.14c0-.95.26-1.59 1.62-1.59h1.73V3.62c-.3-.04-1.33-.13-2.53-.13-2.5 0-4.21 1.53-4.21 4.33v2.41H7.28v3.27h2.83v8.4h3.39Z" />
          </svg>
        </button>
        <button type="button" onClick={copyLink} className={buttonClass} aria-label={t('copy')} title={t('copy')}>
          {copied ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
        </button>
      </div>
      <p className={`mt-3 text-xs text-teal-100 transition-opacity ${copied ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
        {t('copied')}
      </p>
    </div>
  );
}
