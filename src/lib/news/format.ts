// お知らせの日付表示(公開側・サーバー/クライアント共用)。日本時間で日付だけを出す。
const FORMATTERS: Record<string, Intl.DateTimeFormat> = {}

export function formatNewsDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const key = locale === 'ja' ? 'ja' : locale === 'es' ? 'es' : 'en'
  if (!FORMATTERS[key]) {
    FORMATTERS[key] = new Intl.DateTimeFormat(
      key === 'ja' ? 'ja-JP' : key === 'es' ? 'es-ES' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }
    )
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return FORMATTERS[key].format(date)
}

// 一覧の年見出し(日本時間の年)。ja は「2026年」、en・es は「2026」になる
const YEAR_FORMATTERS: Record<string, Intl.DateTimeFormat> = {}

export function formatNewsYear(iso: string | null, locale: string) {
  if (!iso) return ''
  const key = locale === 'ja' ? 'ja-JP' : locale === 'es' ? 'es-ES' : 'en-US'
  if (!YEAR_FORMATTERS[key]) {
    YEAR_FORMATTERS[key] = new Intl.DateTimeFormat(key, { year: 'numeric', timeZone: 'Asia/Tokyo' })
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return YEAR_FORMATTERS[key].format(date)
}
