// お問い合わせの内容の種類(純粋)。値は DB と運営の画面のため日本語を正本にし、画面では訳(messages の app.contact.categories.<id>)を出す。
// API は種類を自由な文字で受けるので、運営への知らせ(Discord)には、この一覧にある種類だけを書く(送られた文字をそのまま外へ出さない)
export type ContactCategory = { readonly id: string; readonly ja: string }

const ABOUT_SERVICE = { id: 'aboutService', ja: 'サービスについて知りたい' } as const
const JOIN_AS_SUPPORTER = { id: 'joinAsSupporter', ja: '支援団体として参加したい' } as const
// 使ってみての意見(不便と、こんなものがあったら)。2026-11-27 の支援団体の登録面談から(#175)
const FEEDBACK = { id: 'feedback', ja: 'アプリへの意見・要望' } as const
const MEDIA = { id: 'media', ja: '取材・メディア' } as const
const OTHER = { id: 'other', ja: 'その他' } as const

export const CONTACT_CATEGORIES = {
  // ログインしていない人
  guest: [ABOUT_SERVICE, JOIN_AS_SUPPORTER, FEEDBACK, MEDIA, OTHER],
  // ログインした人(相談者も支え手も)
  person: [
    { id: 'howto', ja: '使い方がわからない' },
    { id: 'stuck', ja: '相談が進まない・困っている' },
    { id: 'matchingComplaint', ja: '支え手とのやりとりに困っている' },
    { id: 'relink', ja: 'ログインの方法を付け替えたい' },
    FEEDBACK,
    JOIN_AS_SUPPORTER,
    OTHER,
  ],
} as const satisfies Record<string, readonly ContactCategory[]>

const KNOWN = new Set<string>([...CONTACT_CATEGORIES.guest, ...CONTACT_CATEGORIES.person].map((c) => c.ja))

// 一覧にある種類ならその名前、なければ null
export function knownContactCategory(category: string): string | null {
  return KNOWN.has(category) ? category : null
}
