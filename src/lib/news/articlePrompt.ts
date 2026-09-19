// note 記事ワークフローのプロンプト(純粋関数・server-only にしない: 単体で検証できるように)。
// 設計: docs/news_section_design.md §4.5。工程は3つ: 切り口3案 → 本文 → 見直し(確認リスト)。
import { type NewsAngle, NEWS_INTERVIEW_SOURCE_MAX, NEWS_ARTICLE_MAX } from '../constants/news'

// ライターの人格。伊藤さんの記事(docs/articles/note_20260908_*)で決めた作り方をそのまま規範にする
const WRITER = `あなたは「明日もsamasama」(困っている人と、NPO・行政・企業などの支援団体をつなぐサービス)の運営が出す note の記事を書くライターです。支援の現場で活動する人へのインタビューを、読み手を引き込む読み物に仕上げます。

書き方の規範:
- 人物の物語で運ぶ。なぜその人が始めたのか、考えが変わった転換点はどこか、いま何を大切にしているか。説教や制度解説ではなく、その人の言葉と歩みで読ませる
- 当事者の尊厳を損なわない。困難を抱える人を「かわいそうな人」として描かない。感動の押し売り、誇張、決めつけをしない
- 読者は3人いる。①働けない・生きづらいなど困りごとを抱えながら、まだ誰にも相談できていない人 ②実習の場や仕事を提供しうる経営者・団体 ③自分事として知りたい一般の読者。この3人に同時に届く切り口と言葉を選ぶ。①の読者を怖がらせない順序で書く(安心を先に、重い話は後に)
- 引用(発言)は材料にある言葉だけを使う。整える程度の修正はよいが、言っていないことを言わせない
- SDGs の番号やゴール名を前面に出さない。取材相手が SDGs に触れた場合だけ、正直な距離感で書く
- 運営者は「運営」と呼ぶ。サービス名は「明日もsamasama」。です・ます調。1段落は3〜4文まで`

const RULES = `守るべき鉄則:
- 材料に書かれていない事実(経歴・年数・人数・地名・団体の活動内容)を推測で書かない。足りない情報は「[要確認: ○○]」の形で本文中に残す
- 取材相手の個人名・所属は、材料に「掲載可」と明記されている場合だけ書く。電話番号・メールアドレス・住所は書かない
- 材料の中に「非公開」「オフレコ」「書かないで」とある内容は使わない
- 取材相手が語った支援先の人のエピソードは、個人が特定されない粒度(年代・状況)でのみ使う。実名・具体的な勤務先・病名は書かない
- 明日もsamasama に寄せられた相談の内容は書かない`

const FORMAT = `本文の書式(この4つだけ。Markdown の太字・箇条書き・表・リンク記法は使わない):
- 段落と段落の間は空行を1つ
- 見出しは行頭に「## 」(必要なら小見出しは「### 」)
- 引用(取材相手の言葉)は行頭に「> 」
- URL は https:// から始まる文字列をそのまま書く`

function clip(value: string | undefined, max: number) {
  return (value ?? '').trim().slice(0, max)
}

function sourceBlock(source: string) {
  return `材料(取材メモ・書き起こし。ここに書かれていることだけを使う):\n"""\n${source}\n"""`
}

// 工程1: 切り口を3案
export function buildAnglesPrompt(rawSource: string) {
  const source = clip(rawSource, NEWS_INTERVIEW_SOURCE_MAX)
  if (!source) return null
  return `${WRITER}

${RULES}

これから記事を書く前に、切り口を3つ提案してください。同じ材料でも「誰の、どの話を軸にするか」で別の記事になります。3案は互いに違う軸にしてください(例: 人物の転換点を軸にする / 取材相手の一番強い主張を軸にする / 読者①が明日できる一歩を軸にする)。

各案に含めるもの:
- title: タイトル案(40字以内。読み手が自分事として引き込まれる言葉。誇張しない)
- audience: この記事は誰に何を伝えるか(2文以内)
- hook: 冒頭の一文(この一文で読み進めたくなるもの。材料にある事実だけ)
- why: なぜこの切り口が材料に合うか(1〜2文)

${sourceBlock(source)}

出力はJSONのみ: {"angles": [{"title": "", "audience": "", "hook": "", "why": ""}, ...3件]}`
}

// 工程2: 本文
export function buildWritePrompt(rawSource: string, angle: NewsAngle) {
  const source = clip(rawSource, NEWS_INTERVIEW_SOURCE_MAX)
  if (!source) return null
  return `${WRITER}

${RULES}

${FORMAT}

選ばれた切り口:
- タイトル案: ${angle.title}
- 誰に何を伝えるか: ${angle.audience}
- 冒頭の一文: ${angle.hook}
- 理由: ${angle.why}

この切り口で note に載せる記事を書いてください。
- 本文は 3,000〜4,000 字を目安にする。ただし材料が少ないときは無理に伸ばさない(材料にない話で水増しするより、短くても事実だけの記事の方がよい)。見出しは 4〜6 個
- 取材相手の言葉で立てたい引用は、地の文に埋めず「> 」で始まる独立した行にする(3〜5 箇所)。それ以外の短い発言は地の文に「」で入れてよい
- 構成の目安: リード(問題の定義と、人物の予告) → 読者①への安心(どんな人でも、急がない、など材料にあれば) → 人物の原点と転換点 → 取材相手の核心の主張(引用を最大に立てる) → 読者②③が今日からできること(材料にあれば) → 取材を終えて(運営の視点で短く) → 団体情報と、相談は明日もsamasama から送れるという導線
- タイトルは本文に含めない(note のタイトル欄に入れる)
- サイト用の導入文(lead)も別に書く: 誰に何を聞いたか → 印象に残った一言 → 「続きは note の記事でお読みください」。100〜200字、見出しなし

${sourceBlock(source)}

出力はJSONのみ: {"title": "記事タイトル", "lead": "サイト用の導入文", "article": "本文"}`
}

// 工程3: 見直し(編集・ファクト・倫理の目で読み、取材相手に確認する項目を出す)
export function buildReviewPrompt(rawSource: string, rawArticle: string) {
  const source = clip(rawSource, NEWS_INTERVIEW_SOURCE_MAX)
  const article = clip(rawArticle, NEWS_ARTICLE_MAX)
  if (!source || !article) return null
  return `あなたは「明日もsamasama」の note 記事の編集者です。ライターが書いた記事を、公開前に3つの目で読みます。
1. ファクト: 材料(取材メモ)にない事実・数字・言葉が本文に入っていないか。引用が材料の発言と食い違っていないか
2. 倫理・個人情報: 取材相手や支援先の人が特定される記述、尊厳を損なう表現、「非公開」とされた内容の混入がないか
3. 編集: 読者(困りごとを抱える人 / 経営者・団体 / 一般読者)を怖がらせたり置き去りにしたりする箇所、冗長・誇張・決めつけがないか

出力するのは「公開前に取材相手に確認・了承をもらう項目」と「ライターが直すべき箇所」のリストです。
- kind は次のどれか: fact(事実の確認) / quote(引用の確認) / privacy(個人情報・特定リスク) / consent(掲載の了承が要る箇所) / fix(ライターが直す箇所)
- text は、記事のどの箇所(冒頭の数語を引く)について、何を確認・修正するかを1〜2文で
- 問題がない観点は無理に挙げない。多くても 12 件
- summary は全体の所見を2〜3文で(良い点も1つ含める)

材料:
"""
${source}
"""

記事本文:
"""
${article}
"""

出力はJSONのみ: {"summary": "", "items": [{"kind": "fact", "text": ""}, ...]}`
}

export const REVIEW_KIND_LABEL: Record<string, string> = {
  fact: '事実確認',
  quote: '引用確認',
  privacy: '個人情報',
  consent: '掲載了承',
  fix: '要修正',
}

// 見直し結果を、そのまま取材相手に送れる文章(確認リスト)に整える
export function formatChecklist(summary: string, items: { kind: string; text: string }[]) {
  const lines = ['【公開前の確認リスト】', '']
  if (summary.trim()) lines.push(summary.trim(), '')
  const order = ['consent', 'fact', 'quote', 'privacy', 'fix']
  for (const kind of order) {
    const group = items.filter((item) => item.kind === kind)
    if (group.length === 0) continue
    lines.push(`■ ${REVIEW_KIND_LABEL[kind] ?? kind}`)
    for (const item of group) lines.push(`□ ${item.text.trim()}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
