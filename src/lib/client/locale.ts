'use client'

// 画面の言語をブラウザに覚えておく(言語の切り替えと、ログインした人の言語に合わせるところで使う)
import type { AppLocale } from '@/i18n/routing'

// このタブで本人の言語に一度合わせたか(または自分で選んだか)。合わせ直しは1回だけにする
export const LOCALE_RESTORED_KEY = 'samasama.localeRestored'

// 自分で言語を選んだとき。次に開いたときもこの言語で始め(proxy の next-intl が NEXT_LOCALE を読む)、本人の言語に合わせ直さない
export function rememberChosenLocale(locale: AppLocale) {
  try {
    window.sessionStorage.setItem(LOCALE_RESTORED_KEY, '1')
  } catch {
    // 保存できなくても切り替えはできる
  }
  document.cookie = `NEXT_LOCALE=${locale}; path=/; samesite=lax`
}
