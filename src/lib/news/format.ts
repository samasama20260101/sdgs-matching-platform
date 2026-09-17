// お知らせの日付表示(公開側・サーバー/クライアント共用)。日本時間で日付だけを出す。
const FORMATTERS: Record<string, Intl.DateTimeFormat> = {}

export function formatNewsDate(iso: string | null, locale: string) {
  if (!iso) return ''
  const key = locale === 'ja' ? 'ja' : locale === 'zh' ? 'zh' : 'en'
  if (!FORMATTERS[key]) {
    FORMATTERS[key] = new Intl.DateTimeFormat(
      key === 'ja' ? 'ja-JP' : key === 'zh' ? 'zh-CN' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }
    )
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return FORMATTERS[key].format(date)
}
