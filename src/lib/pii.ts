// AI に渡す直前の個人情報マスク(層1: 正規表現)。
// 出典: /admin/mask-lab の層1ルールをサーバー側に移植したもの(2026-09-26)。ルールを変えるときは両方を揃える。
//
// 位置づけ(2026-09-01 の壁打ちで決定):
// - 適用先は AI に渡す直前だけ。DB に保存する相談文とサポーターに見せる表示はマスクしない
// - 消しすぎは許容し、完璧は求めない。漏れた分は Gemini API の無学習契約が受け止める二段構え
// - 層2(形態素解析による人名・地名・組織名)は未導入。必要になればここに足す
//
// 使い方: classifySDGs / classifyConcernLabels / classifyDisasterNeedsText が内部で maskPii を呼ぶので、
// 呼び出し側は生の相談文を渡してよい。

export type PiiCategory = 'url' | 'email' | 'sns' | 'postal' | 'phone' | 'dob' | 'address' | 'number'

// 置き換え後の印。AI にも「伏せた箇所」と分かる日本語にする
export const PII_PLACEHOLDERS: Record<PiiCategory, string> = {
  url: '【URL】',
  email: '【メールアドレス】',
  sns: '【SNSのID】',
  postal: '【郵便番号】',
  phone: '【電話番号】',
  dob: '【生年月日】',
  address: '【住所】',
  number: '【番号】',
}

type Span = { start: number; end: number; cat: PiiCategory }

// 配列順 = 重なったときの優先順
const REGEX_RULES: { cat: PiiCategory; re: () => RegExp }[] = [
  { cat: 'url', re: () => /https?:\/\/[^\s　]+/g },
  { cat: 'email', re: () => /[A-Za-z0-9._%+-]+\s{0,2}@\s{0,2}[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // LINE ID: tanaka_123 / @handle 形式
  { cat: 'sns', re: () => /(?:LINE|ライン|Instagram|インスタ(?:グラム)?|Twitter|TikTok|X)\s*(?:の)?\s*(?:ID|ＩＤ|アイディー?)\s*[:：]?\s*[A-Za-z0-9_.-]{3,}|@[A-Za-z0-9_.]{3,}/g },
  { cat: 'postal', re: () => /〒\s*[0-9０-９]{3}[-−ー‐]?[0-9０-９]{4}|(?<![0-9-])[0-9]{3}[-−ー‐][0-9]{4}(?![0-9-])/g },
  { cat: 'phone', re: () => /(?:\+81[-−ー‐\s]?|0|０)[0-9０-９]{1,4}[-−ー‐()（）.・\s]?[0-9０-９]{1,4}[-−ー‐()（）.・\s]?[0-9０-９]{3,4}/g },
  // 年つきの日付のみ(「来週の3月2日」のような予定日は拾わない)
  { cat: 'dob', re: () => /(?:19|20|１９|２０)[0-9０-９]{2}\s*年\s*[0-9０-９]{1,2}\s*月\s*[0-9０-９]{1,2}\s*日\s*(?:生まれ|生)?/g },
  // 市区町村+丁目・番地・号の並び(番地なしの「市役所」等は拾わない)
  { cat: 'address', re: () => /(?:[一-龥]{2,3}[都道府県])?[一-龥ぁ-んァ-ヶー]{1,8}(?:市|区|郡|町|村)(?:[一-龥ぁ-んァ-ヶー]{1,10})?(?:[0-9０-９一二三四五六七八九十]{1,4}(?:丁目|番地|番|号|[-−ー‐])\s?){1,4}[0-9０-９]{0,4}(?:号室|号)?/g },
  // 建物名+部屋番号。部屋番号がない建物名はひらがなを含めない(助詞・動詞への食い込み防止)
  { cat: 'address', re: () => /(?:コーポ|ハイツ|メゾン|アパート|マンション|レジデンス)[一-龥ぁ-んァ-ヶーA-Za-z0-9０-９]{0,12}?[0-9０-９]{1,4}\s?号室?|(?:コーポ|ハイツ|メゾン|アパート|マンション|レジデンス)[一-龥ァ-ヶーA-Za-z0-9０-９]{0,12}|[0-9０-９]{1,4}号室/g },
  // 口座番号・マイナンバー等の7桁以上の数字列
  { cat: 'number', re: () => /(?<![0-9])[0-9]{7,}(?![0-9])/g },
]

const CAT_ORDER: PiiCategory[] = ['url', 'email', 'sns', 'postal', 'phone', 'dob', 'address', 'number']

// 検出前の正規化: 全角英数字・記号・全角スペースを半角へ(NFKC)。
// 文字数が変わらない置換だけ適用するので、検出位置は原文とずれない。
function normalizeForDetection(original: string): string {
  let out = ''
  for (const ch of original) {
    const n = ch.normalize('NFKC')
    out += n.length === ch.length ? n : ch
  }
  return out
}

function detectSpans(original: string): Span[] {
  const text = normalizeForDetection(original)
  const spans: Span[] = []
  for (const rule of REGEX_RULES) {
    const re = rule.re()
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      spans.push({ start: m.index, end: m.index + m[0].length, cat: rule.cat })
    }
  }
  return spans
}

// 重なりの解決: 開始位置が早い→長い→ルール順、の優先で採用
function resolveOverlaps(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) =>
    a.start - b.start || (b.end - b.start) - (a.end - a.start) || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat)
  )
  const accepted: Span[] = []
  for (const s of sorted) {
    if (accepted.some((a) => s.start < a.end && a.start < s.end)) continue
    accepted.push(s)
  }
  return accepted.sort((a, b) => a.start - b.start)
}

export type MaskResult = { text: string; counts: Partial<Record<PiiCategory, number>> }

// 検出した箇所を印に置き換えた文と、種類ごとの件数(ログ用。原文は返さない)
export function maskPiiDetailed(original: string): MaskResult {
  if (!original) return { text: original, counts: {} }
  const spans = resolveOverlaps(detectSpans(original))
  if (spans.length === 0) return { text: original, counts: {} }
  const counts: Partial<Record<PiiCategory, number>> = {}
  let out = ''
  let cursor = 0
  for (const s of spans) {
    out += original.slice(cursor, s.start) + PII_PLACEHOLDERS[s.cat]
    counts[s.cat] = (counts[s.cat] ?? 0) + 1
    cursor = s.end
  }
  out += original.slice(cursor)
  return { text: out, counts }
}

export function maskPii(original: string): string {
  return maskPiiDetailed(original).text
}
