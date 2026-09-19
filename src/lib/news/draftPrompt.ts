// お知らせ AI 下書きのプロンプト(純粋関数・server-only にしない: 単体で検証できるように)。
// 設計: docs/news_section_design.md §4。声(共通)+構造(種別別)の2層と鉄則。
import { type NewsCategory, NEWS_MATERIAL_MAX } from '../constants/news'

export type NewsDraftMaterials = {
  site?: string  // 参加団体: 団体のサイトから写した文
  memo?: string  // 参加団体: 電話などで聞いたメモ
  notes?: string // その他の種別: 伝えたいことのメモ
}

export type NewsDraft = { title: string; body: string }

const VOICE = `あなたは「明日もsamasama」の運営スタッフです。明日もsamasama は、生活や仕事などで困っている人と、NPO・行政・企業などの支援団体をつなぐサービスです。サイトのトップページにある「お知らせ」欄に載せる文章を書きます。

書き方の決まり(すべての種別に共通):
- 読者は「困っている人」と「支援する団体」の両方です。困っている人を不安にさせたり、急かしたりする言い回しは使いません
- SDGsの番号やゴール名を前面に出しません(SDGsはサービスの裏側の言葉で、読者の言葉ではありません)
- 運営者は「運営」と呼びます。「管理者」「事務局」とは書きません。サービス名は「明日もsamasama」と表記します
- です・ます調。1段落は3文まで。小見出しは体言止め
- 誇張や断定を避けます。「必ず解決」「すぐに」「誰でも」などは書きません`

const RULES = `守るべき鉄則:
- 材料に書かれていない事実(活動内容・実績・地域・年数・人数など)を推測で書きません。足りない情報は本文中に「[要確認: 活動地域]」のように角括弧で残し、書き手が後から埋められるようにします
- 個人名・電話番号・メールアドレス・住所は、材料に「掲載可」と明記されていない限り本文に書きません
- 相談者個人の事例や相談内容が材料に含まれていても、本文には書きません
- 材料の中に「書かないで」「非公開」「オフレコ」とある内容は使いません`

const FORMAT = `本文の書式(この3つだけ):
- 段落と段落の間は空行を1つ入れる
- 小見出しは行頭に「## 」を付ける(必要な種別のみ)
- リンクは https:// から始まるURLをそのまま書く(Markdownのリンク記法は使わない)
- 太字・箇条書き記号・表・絵文字は使わない`

const STRUCTURE: Record<NewsCategory, string> = {
  NOTICE: `種別: お知らせ
- タイトルは20字前後
- 本文は300字前後。小見出しは付けても付けなくてもよい
- 順番: 何が・いつから → 変わらないこと → 変わること → 問い合わせ先(「お問い合わせフォームからご連絡ください」と書く。URLは書かない)`,
  MAINTENANCE: `種別: メンテナンス
- タイトルは「○月○日 メンテナンスのお知らせ」の形
- 本文は150〜250字。小見出しは付けない
- 順番: 日時(日本時間。開始と終了) → 所要時間 → 影響する機能(ログイン・相談の投稿・メッセージのやりとり、のうち材料にあるもの) → お詫び → 完了後の案内
- 日時や影響範囲が材料にない場合は「[要確認: 日時]」のように残す`,
  SUPPORTER_JOINED: `種別: 参加団体の紹介
- タイトルは「○○(団体名)が参加しました」を基本にする
- 本文は400〜600字。小見出しを2〜3つ付ける
- 順番: 団体名と種別(NPO/行政/企業のうち材料から分かるもの) → 活動地域 → 何をしている団体か → どんな困りごとに応えられるか → 団体からのひとこと(材料にあれば。なければ書かない)
- 最後に、この団体への相談は明日もsamasamaから送れる、と一文添える`,
  INTERVIEW: `種別: インタビュー記事の紹介
- タイトルは記事の芯が伝わる20〜30字
- 本文は100〜200字の導入文。小見出しは付けない
- 順番: 誰に何を聞いたか → 印象に残った一言(材料にある言葉だけを使う) → 「続きは note の記事でお読みください」で締める
- URLは本文に書かない(外部リンク欄に別途入る)`,
}

function clip(value: string | undefined) {
  return (value ?? '').trim().slice(0, NEWS_MATERIAL_MAX)
}

function materialBlock(label: string, value: string) {
  return `【${label}】\n"""\n${value}\n"""`
}

// 材料を種別に応じて整形する。空なら null(呼び出し側で 400 にする)
export function buildMaterialSection(category: NewsCategory, materials: NewsDraftMaterials) {
  if (category === 'SUPPORTER_JOINED') {
    const site = clip(materials.site)
    const memo = clip(materials.memo)
    if (!site && !memo) return null
    const blocks = []
    if (site) blocks.push(materialBlock('団体のサイトから写した文', site))
    if (memo) blocks.push(materialBlock('電話などで聞いたメモ', memo))
    return blocks.join('\n\n')
  }
  const notes = clip(materials.notes)
  if (!notes) return null
  return materialBlock('伝えたいことのメモ', notes)
}

export function buildNewsDraftPrompt(category: NewsCategory, materials: NewsDraftMaterials) {
  const section = buildMaterialSection(category, materials)
  if (!section) return null
  return `${VOICE}

${RULES}

${FORMAT}

${STRUCTURE[category]}

材料(ここに書かれていることだけを使う):
${section}

出力はJSONのみ。説明文は不要です: {"title": "タイトル", "body": "本文"}`
}
