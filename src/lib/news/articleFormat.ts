// note 記事本文の整形(純粋関数)。書式は「## 見出し / ### 小見出し / > 引用 / 空行=段落」だけ。
// 管理画面のプレビューと、note に貼るための書式付きコピー(HTML)の両方がこれを使う。

export type ArticleBlock =
  | { type: 'h2' | 'h3' | 'p'; text: string }
  | { type: 'quote'; text: string }

export function parseArticleBlocks(text: string): ArticleBlock[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('### ')) return { type: 'h3' as const, text: block.slice(4).trim() }
      if (block.startsWith('## ')) return { type: 'h2' as const, text: block.slice(3).trim() }
      const lines = block.split('\n')
      if (lines.every((line) => line.startsWith('>'))) {
        return { type: 'quote' as const, text: lines.map((line) => line.replace(/^>\s?/, '')).join('\n').trim() }
      }
      return { type: 'p' as const, text: block }
    })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function withBreaks(value: string) {
  return escapeHtml(value).split('\n').join('<br>')
}

// クリップボード用の HTML。note のエディタは HTML の貼り付けで見出し・引用を残せる(要実機確認)
export function articleToHtml(text: string) {
  return parseArticleBlocks(text)
    .map((block) => {
      switch (block.type) {
        case 'h2': return `<h2>${escapeHtml(block.text)}</h2>`
        case 'h3': return `<h3>${escapeHtml(block.text)}</h3>`
        case 'quote': return `<blockquote><p>${withBreaks(block.text)}</p></blockquote>`
        default: return `<p>${withBreaks(block.text)}</p>`
      }
    })
    .join('\n')
}

// 書式なしで貼るときの文章(見出しはそのまま1行、引用は「」で囲む)
export function articleToPlainText(text: string) {
  return parseArticleBlocks(text)
    .map((block) => (block.type === 'quote' ? `「${block.text}」` : block.text))
    .join('\n\n')
}
