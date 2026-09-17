// お知らせ本文の描画。書式は3規則だけ(空行=段落 / 行頭「## 」=小見出し / http(s) URL は自動リンク)。
// React 要素で組み立てるので dangerouslySetInnerHTML は使わない。サーバー・クライアント両方で使える。
import React from 'react'

const URL_SOURCE = 'https?:\\/\\/[^\\s<>"\'）)。、」]+'

function linkify(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = new RegExp(URL_SOURCE, 'g')
  const nodes: React.ReactNode[] = []
  let last = 0
  let index = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push(
      <a
        key={`${keyPrefix}-${index++}`}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-600 underline decoration-teal-300 underline-offset-2 break-all hover:text-teal-700"
      >
        {match[0]}
      </a>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function splitNewsBlocks(body: string) {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
}

export function NewsBody({ body }: { body: string }) {
  const blocks = splitNewsBlocks(body)
  return (
    <div className="space-y-5 text-[15px] leading-8 text-gray-700 sm:text-base">
      {blocks.map((block, blockIndex) => {
        if (block.startsWith('## ')) {
          return (
            <h2 key={blockIndex} className="pt-4 text-lg font-bold text-gray-900">
              {block.slice(3).trim()}
            </h2>
          )
        }
        const lines = block.split('\n')
        return (
          <p key={blockIndex}>
            {lines.map((line, lineIndex) => (
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
