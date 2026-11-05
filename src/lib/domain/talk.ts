// やりとりの一覧の「だれの番か」と並べ方(画面の見直し 所見 2・7。純粋関数)。
// 最後のメッセージを相手の側が書いていたら、こちらが返す番。メッセージがなければ番はない
export type TalkSide = 'CONSULTEE' | 'SUPPORTER'
export type LastMessage = { at: string; preview: string; side: TalkSide; senderName: string | null }
export type TalkTurn = 'mine' | 'theirs' | 'none'

export function talkTurn(last: LastMessage | null | undefined, viewer: TalkSide): TalkTurn {
  if (!last) return 'none'
  return last.side === viewer ? 'theirs' : 'mine'
}

// こちらの番のものを先に、そのあとは最後のメッセージが新しい順(メッセージのないものは作った日の新しい順で最後に)
export function sortTalks<T extends { lastMessage?: LastMessage | null; createdAt: string }>(items: readonly T[], viewer: TalkSide): T[] {
  const key = (i: T) => i.lastMessage?.at ?? ''
  return [...items].sort((a, b) => {
    const ta = talkTurn(a.lastMessage, viewer) === 'mine' ? 0 : 1
    const tb = talkTurn(b.lastMessage, viewer) === 'mine' ? 0 : 1
    if (ta !== tb) return ta - tb
    const ka = key(a), kb = key(b)
    if (ka !== kb) return ka < kb ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  })
}

// 一覧に出す一文。改行をつめ、長ければ切る
export function previewText(content: string, max = 60): string {
  const one = content.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max)}…` : one
}
