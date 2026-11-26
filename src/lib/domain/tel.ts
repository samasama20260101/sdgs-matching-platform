// 電話番号から「電話する」のリンクを作る(純粋関数)。
// 「#8008」(DV相談ナビ)・「#8778」のような短縮番号の # は、URL ではフラグメントの始まりになる。
// そのまま tel:#8008 と書くと番号が消え、押しても電話がかからなかった。RFC 3966 に合わせて %23 にする。
// 空白・ハイフン・括弧は落とす(掲載台帳は数字だけで持つが、手で入れた番号にも備える)。+ は国番号なので残す
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const dial = phone.normalize('NFKC').replace(/[\s\-‐−()]/gu, '')
  if (!/^\+?[0-9#*]+$/.test(dial)) return null
  return `tel:${dial.replace(/#/g, '%23')}`
}
