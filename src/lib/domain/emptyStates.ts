// 相談がまだないときの、相談者のホームとやりとりに出すものを選ぶ(#177。2026-11-28 に決めたキャンバスの「決定案」)
// キャンバス: https://claude.ai/artifact/EHkSSxiUZ9AFBYvUD7MSsm
import { regionFirst } from './publicSupporter'

// ホームに並べる団体とお知らせの数
export const HOME_SUPPORTER_TILES = 2
export const HOME_NEWS_ITEMS = 2

// ホームの団体のタイル: 見ている人の地域で受けている団体(全国の団体を含む)を先にして、上から 2 つ。
// 並びの元は公開の一覧と同じ(承認が新しい順)
export function homeSupporterTiles<T extends { nationwide: boolean; areas: { region_code: string }[] }>(list: readonly T[], regionCode: string | null): T[] {
  return regionFirst([...list], regionCode).items.slice(0, HOME_SUPPORTER_TILES)
}

// 名前の前に付く法人の種類。頭文字のタイルでは飛ばす(「NPO法人ことさんち」は「こ」)
const ENTITY_PREFIXES = [
  '特定非営利活動法人', 'NPO法人', '認定NPO法人', '一般社団法人', '公益社団法人', '一般財団法人', '公益財団法人',
  '社会福祉法人', '学校法人', '医療法人', '株式会社', '合同会社', '有限会社', '(株)', '（株）', '(一社)', '（一社）',
].sort((a, b) => b.length - a.length)

// 団体のタイルに出す 1 文字(写真の登録は #178)。サロゲートペアを割らない。ラテン文字は大文字にする
export function supporterInitial(name: string): string {
  let rest = name.trim()
  for (let stripped = true; stripped;) {
    stripped = false
    for (const p of ENTITY_PREFIXES) {
      if (rest.startsWith(p) && rest.length > p.length) {
        rest = rest.slice(p.length).trim()
        stripped = true
      }
    }
  }
  const first = Array.from(rest)[0] ?? ''
  return first.toLocaleUpperCase('en')
}
