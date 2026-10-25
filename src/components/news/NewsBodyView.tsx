// お知らせ本文の描画(公開ページと管理画面のプレビューで共用)。サーバー専用の部品は持たないので、どちらからでも使える。
// 書式は4規則だけ: 空行=段落 / 行頭「## 」=小見出し / 文中の http(s) URL は自動リンク / URL を1行だけで置くと OGP カード
// React 要素で組み立てるので dangerouslySetInnerHTML は使わない。
import React from 'react'
import { parseNewsBody } from '@/lib/news/bodyBlocks'

// URL は ASCII だけ(日本語の文が URL の直後に続いても巻き込まない)。末尾の句読点・閉じ括弧は URL に含めない
const URL_SOURCE = "https?:\\/\\/[A-Za-z0-9\\-._~:/?#\\[\\]@!$&'()*+,;=%]+"
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"]+$/
const URL_ONLY_LINE = new RegExp(`^${URL_SOURCE}$`)

function linkify(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = new RegExp(URL_SOURCE, 'g')
  const nodes: React.ReactNode[] = []
  let last = 0
  let index = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const url = match[0].replace(TRAILING_PUNCTUATION, '')
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push(
      <a
        key={`${keyPrefix}-${index++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-600 underline decoration-teal-300 underline-offset-2 break-all hover:text-teal-700"
      >
        {url}
      </a>
    )
    last = match.index + url.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// renderLinkCard: 1 行だけの URL をどう見せるか(公開ページは OGP カード、管理画面のプレビューは仮のカード)
export function NewsBodyView({ body, renderLinkCard }: { body: string; renderLinkCard: (url: string, key: number) => React.ReactNode }) {
  const blocks = parseNewsBody(body)
  return (
    <div className="space-y-5 text-[15px] leading-8 text-gray-700 sm:text-base">
      {blocks.map((block, blockIndex) => {
        if (block.kind === 'heading') {
          return (
            <h2 key={blockIndex} className="pt-4 text-lg font-bold text-gray-900">
              {block.text}
            </h2>
          )
        }
        if (block.lines.length === 1 && URL_ONLY_LINE.test(block.lines[0])) {
          return renderLinkCard(block.lines[0].replace(TRAILING_PUNCTUATION, ''), blockIndex)
        }
        return (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {linkify(line, `${blockIndex}-${lineIndex}`)}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
