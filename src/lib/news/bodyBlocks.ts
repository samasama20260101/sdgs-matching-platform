// お知らせ本文の段落分け(公開側の描画と管理画面のプレビューで共用、サーバー/クライアントどちらでも使える)。
// 書式: 空行=段落 / 行頭「## 」=小見出し

export type NewsBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }

export function splitNewsBlocks(body: string) {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
}

// 「## 小見出し」の次の行にそのまま本文が続く書き方(AI の下書きがこの形になる)でも、
// 見出しは 1 行目だけにして、残りは段落にする(以前は段落ごと見出しの太字になっていた)
export function parseNewsBody(body: string): NewsBlock[] {
  const result: NewsBlock[] = []
  for (const block of splitNewsBlocks(body)) {
    const lines = block.split('\n')
    if (lines[0].startsWith('## ')) {
      const text = lines[0].slice(3).trim()
      if (text) result.push({ kind: 'heading', text })
      const rest = lines.slice(1).filter((line) => line.trim() !== '')
      if (rest.length > 0) result.push({ kind: 'paragraph', lines: rest })
    } else {
      result.push({ kind: 'paragraph', lines })
    }
  }
  return result
}

// AI の下書きが「材料にない情報」に残す印。これが残ったままでは公開させない
const PLACEHOLDER_PATTERN = /[[［]\s*要確認/

export function hasUnresolvedPlaceholder(...texts: string[]) {
  return texts.some((text) => PLACEHOLDER_PATTERN.test(text))
}
