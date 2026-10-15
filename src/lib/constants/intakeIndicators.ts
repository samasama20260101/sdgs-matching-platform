// 相談フォームの選択肢(SDGs グローバル指標ベース)と大項目。
// 正本は docs/intake_indicators.md。文言は日本語固定(サポーター側・AI 入力・相談者側 ja の元)。
// 相談者側の多言語の文言は messages/<言語>/sdgs.json の category / indicator から出す(キーは indicatorMessageKey)。
// 文言を直すときは docs・ここ・messages の 3 か所をそろえる(scripts/tests/intakeIndicators.test.ts が ja の一致を検査する)。

// 0 個選択のときに自動で付く大項目。SDGs のゴール番号ではないが、表示・フィルターのため sdgs_goals に同居させる
export const NEIGHBOR_CATEGORY = 18;

// 選べる数の上限
export const MAX_INDICATOR_SELECTIONS = 3;

// 大項目(15 は選択肢なし・AI が 15 を付けた過去案件の表示用、18 は 0 個選択用)
export const INTAKE_CATEGORIES: Record<number, string> = {
    1: 'お金・生活',
    2: '食べ物',
    3: 'からだ・こころ',
    4: '教育',
    5: '女性の権利',
    6: '水・トイレ',
    7: '電気・エネルギー',
    8: '仕事・収入',
    9: '通信・インフラ',
    10: '差別・不平等',
    11: '住まい・地域',
    12: '資源・ごみ',
    13: '気候・災害',
    14: '海・漁業',
    15: '森・農地',
    16: '権利・暴力',
    17: '連携',
    18: 'SDGsの隣のお困りごと',
};

export type IntakeIndicator = {
    id: string;       // グローバル指標番号(例: 1.1.1)。言語に依存しない ID
    category: number; // 大項目(= SDGs ゴール番号)
    text: string;     // 相談者向けの文言(日本語)
    urgent?: boolean; // 選ぶと緊急度 High
};

export const INTAKE_INDICATORS: IntakeIndicator[] = [
    { id: '1.1.1', category: 1, text: '今日を過ごすお金がない' },
    { id: '1.2.1', category: 1, text: '収入が少なく、最低限の生活を送ることができない' },
    { id: '1.2.2', category: 1, text: '最低賃金より低い賃金で働いている' },
    { id: '1.3.1', category: 1, text: '給付や手当を申請したいが、書類や手続きが難しい' },
    { id: '1.4.2', category: 1, text: '暮らしている土地の名義や権利が分からず、住み続けられるか不安' },
    { id: '1.5.1', category: 1, text: '災害でけがをしたが、治療や生活の支援につながれていない' },
    { id: '1.a.2', category: 1, text: '教育、健康、社会保護の公共サービスが、自己負担額を支払えないため利用できない' },
    { id: '1.b.1', category: 1, text: '生活に困っているのに、公的な支援を利用できない' },
    { id: '2.1.1', category: 2, text: '食べ物が足りない' },
    { id: '2.1.2', category: 2, text: '食費が足りず、食事の回数や量を減らしている' },
    { id: '2.2.1', category: 2, text: '5歳未満の子どもの身長の伸びを指摘されたが、相談先が分からない' },
    { id: '2.2.2', category: 2, text: '5歳未満の子どもの体重に関して悩んでいる' },
    { id: '2.2.3', category: 2, text: '貧血である' },
    { id: '2.2.4', category: 2, text: '食事に偏りがある' },
    { id: '2.3.1', category: 2, text: '農業・牧畜・林業を営んでいるが、生産性が上がらない' },
    { id: '2.3.2', category: 2, text: '小規模で農業をしているが、生活費をまかなえていない' },
    { id: '2.4.1', category: 2, text: '農業を営んでいるが、持続可能な運営ができていない' },
    { id: '3.1.1', category: 3, text: '妊娠・出産前後に必要な医療を受けたいが、受けられていない' },
    { id: '3.1.2', category: 3, text: '出産が近いのに、医師や助産師など診てもらう人が決まっていない' },
    { id: '3.2.1', category: 3, text: '5歳未満の子どもに、必要な医療を受けさせられていない' },
    { id: '3.2.2', category: 3, text: '生まれたばかりの赤ちゃんに必要な診察やケアを受けさせられていない' },
    { id: '3.3.1', category: 3, text: 'HIVの検査を受けたいが、相談先や受け方が分からない' },
    { id: '3.3.2', category: 3, text: '結核の検査や受診を勧められたが、何かの理由で病院に行けないままでいる' },
    { id: '3.3.3', category: 3, text: 'マラリアのような症状が出ているが、受診先が見つからない' },
    { id: '3.3.4', category: 3, text: 'B型肝炎と診断されたが、定期的な受診や治療を続けられない' },
    { id: '3.3.5', category: 3, text: 'デング熱などの熱帯病と診断されたが、必要な治療を受けられない' },
    { id: '3.4.1', category: 3, text: 'がん・糖尿病・心臓や肺の病気の治療を続けたいが、お金などの問題で困っている' },
    { id: '3.4.2', category: 3, text: '自殺の方法を真剣に考えたことがある', urgent: true },
    { id: '3.5.1', category: 3, text: 'お酒や薬物の依存症を改善したいが、治療や相談につながれていない' },
    { id: '3.5.2', category: 3, text: '飲酒で家計や仕事に支障が出ているが、どう見直せばよいか分からない' },
    { id: '3.6.1', category: 3, text: '交通事故のけがや後遺症で、通院や生活に困っている' },
    { id: '3.7.1', category: 3, text: '妊娠を望んでいないのに、パートナーが避妊に協力してくれない' },
    { id: '3.7.2', category: 3, text: '10代で妊娠しているかもしれないが、周囲に相談できず一人で悩んでいる' },
    { id: '3.8.2', category: 3, text: '金銭的な理由などで病院に行けない' },
    { id: '3.9.1', category: 3, text: '家の中の煙や空気の悪さがつらいが、換気や設備を改善できない' },
    { id: '3.9.2', category: 3, text: '安全な飲み水を確保できていない' },
    { id: '3.9.3', category: 3, text: '農薬や洗浄剤などで体調を崩した' },
    { id: '3.a.1', category: 3, text: 'たばこの煙による受動喫煙がつらい' },
    { id: '3.b.1', category: 3, text: '必要な予防接種を受けられない' },
    { id: '3.b.3', category: 3, text: '病気の治療で必要な医療機関や薬局が近くにない' },
    { id: '3.c.1', category: 3, text: '近くに診察が行える病院がない' },
    { id: '3.d.2', category: 3, text: '薬が効きにくい感染症にかかっている' },
    { id: '4.1.1', category: 4, text: '学校の授業で使われる文章や問題文を理解することが難しい' },
    { id: '4.1.2', category: 4, text: '学校に通うことができない' },
    { id: '4.2.1', category: 4, text: '幼い子どもの言葉や人とのやり取りが気になるが、相談先が分からない' },
    { id: '4.2.2', category: 4, text: '小学校入学前の子どもが、継続的に学べる場に通えていない' },
    { id: '4.3.1', category: 4, text: '学びたいことがあるが、学べる講座や環境がない' },
    { id: '4.4.1', category: 4, text: 'スマホやパソコンの操作が難しく、オンラインでの手続きができない' },
    { id: '4.5.1', category: 4, text: '性別・障害・経済的な理由で、進学や学習の継続を認めてもらえない' },
    { id: '4.6.1', category: 4, text: '書類に必要事項を記入できず、一人で手続きができない' },
    { id: '4.a.1', category: 4, text: '学校の施設や設備がバリアフリーに対応しておらず、学校生活に支障がある' },
    { id: '4.b.1', category: 4, text: '開発途上国で、仕事に必要な知識や技術を学ぶ機会がない' },
    { id: '4.c.1', category: 4, text: '教員として必要な資格の取得や研修を受ける機会がない' },
    { id: '5.1.1', category: 5, text: '女性であることを理由に、教育や就労の機会が制限されている' },
    { id: '5.2.1', category: 5, text: 'パートナーや元パートナーから暴言や脅迫を受け、恐怖を感じている', urgent: true },
    { id: '5.2.2', category: 5, text: '職場や学校で、望まない身体への接触や性的な行為を強要されている', urgent: true },
    { id: '5.3.1', category: 5, text: '18歳未満で、本人の意思に反して結婚や同居を強いられた', urgent: true },
    { id: '5.3.2', category: 5, text: '慣習や儀式を理由に、性器を傷つける処置を受けるよう求められている', urgent: true },
    { id: '5.4.1', category: 5, text: '介護・家事・育児を一人で担っている' },
    { id: '5.5.1', category: 5, text: '女性が政治に参加するための環境が整わず、立候補や議員活動が難しい' },
    { id: '5.6.1', category: 5, text: '性行為を望んでいないのに、相手に断ることができない', urgent: true },
    { id: '5.a.1', category: 5, text: '農地の所有権や利用権を証明できず、農業の継続に不安がある' },
    { id: '5.b.1', category: 5, text: '自分専用の携帯電話がなく、連絡や各種手続き等に支障がある' },
    { id: '6.1.1', category: 6, text: '家の水道や井戸の水が安全ではない' },
    { id: '6.2.1', category: 6, text: '自宅のトイレがない・故障しているなどの状態で、衛生的な排泄環境を確保できない' },
    { id: '6.b.1', category: 6, text: '地域の水道や排水の問題について、住民の意見を伝える機会がない' },
    { id: '7.1.1', category: 7, text: '電気が使えない' },
    { id: '7.1.2', category: 7, text: '薪や炭を使った調理で室内に煙がこもり、安全な調理環境を確保できない' },
    { id: '8.3.1', category: 8, text: '雇用契約や社会保険の取り扱いが不明確で、安心して働けない' },
    { id: '8.5.1', category: 8, text: '労働時間に見合う賃金が得られていない' },
    { id: '8.5.2', category: 8, text: '仕事がない' },
    { id: '8.6.1', category: 8, text: '就労・就学・職業訓練のいずれの機会も得られていない' },
    { id: '8.7.1', category: 8, text: '15歳未満で働いている' },
    { id: '8.8.1', category: 8, text: 'けがや事故の危険がある環境で働いている' },
    { id: '8.8.2', category: 8, text: '労働組合への加入によって、職場から不利益な扱いを受ける可能性が高い' },
    { id: '8.10.1', category: 8, text: '銀行やATMが遠く、現金を引き出したり窓口に行ったりすることができない' },
    { id: '8.10.2', category: 8, text: '自分名義の銀行口座を持っていない' },
    { id: '9.1.1', category: 9, text: '年間を通じて利用できる道路が近くになく、日常の移動に支障がある' },
    { id: '9.5.2', category: 9, text: '研究資金や雇用継続が難しく、研究活動を続けられない' },
    { id: '9.c.1', category: 9, text: '自宅が携帯電話の通信圏外' },
    { id: '10.1.1', category: 10, text: '家族の失業や就労困難によって世帯収入が減少し、生活の立て直しが難しい' },
    { id: '10.2.1', category: 10, text: '周囲と比べて経済的に余裕がない' },
    { id: '10.3.1', category: 10, text: 'いじめや嫌がらせを受けている' },
    { id: '10.4.1', category: 10, text: '所得が向上しない' },
    { id: '10.7.1', category: 10, text: '海外での就労に伴う借金の返済負担が大きく、生活費を十分に確保できない' },
    { id: '10.7.3', category: 10, text: '海外への移住途中に、仲介者などから監禁や脅迫を受けている', urgent: true },
    { id: '10.7.4', category: 10, text: '迫害や紛争を逃れて国外に避難しているが、安全な生活環境を確保できない' },
    { id: '10.c.1', category: 10, text: '海外送金の手数料負担が大きい' },
    { id: '11.1.1', category: 11, text: '安全に暮らせる住まいがない' },
    { id: '11.2.1', category: 11, text: '近くに公共交通機関がない' },
    { id: '11.6.1', category: 11, text: 'ごみが適切に収集されず、衛生的な生活環境が確保できない' },
    { id: '11.7.1', category: 11, text: '安全な公共空間がないと感じる' },
    { id: '11.7.2', category: 11, text: '職場や学校等で、望まない性的な言動を受けている' },
    { id: '12.3.1', category: 12, text: '食品ロスを減らすための具体的な方法や助言がほしい' },
    { id: '12.5.1', category: 12, text: 'ごみの分別やリサイクルを行う環境が整っていない' },
    { id: '13.2.2', category: 13, text: '異常気象や海面上昇といった危険にさらされている' },
    { id: '14.b.1', category: 14, text: '水産物を適正な価格で売買できず、取引に支障がある' },
    { id: '16.1.1', category: 16, text: '命に関わる暴力を受けているが、安全な避難先がない', urgent: true },
    { id: '16.1.2', category: 16, text: '戦闘や爆撃による危険にさらされているが、安全な場所へ避難できない', urgent: true },
    { id: '16.1.3', category: 16, text: '身体的・精神的・性的な暴力を受けている', urgent: true },
    { id: '16.1.4', category: 16, text: '危険な地域に住んでいる' },
    { id: '16.2.1', category: 16, text: '家庭内で、叫ばれる・大声を出される・怒鳴られる、「ばか」「怠け者」と言われる、揺さぶられる、叩かれる・平手打ちされる・殴られる・蹴られるなどの暴力を受けている', urgent: true },
    { id: '16.2.2', category: 16, text: '身分証やパスポートを取り上げられ、自由に移動・帰国できない', urgent: true },
    { id: '16.2.3', category: 16, text: '子どもの頃に受けた性的暴力(性的な接触や性的行為を強いられる・性的行為を強制されそうになった・性的暴行・搾取を目的とした性的な行為など)の影響で、今も苦しんでいる' },
    { id: '16.3.1', category: 16, text: '暴力や性的被害を受けたが、相談先や必要な手続きが分からない' },
    { id: '16.3.2', category: 16, text: '不当に長期間拘束され、弁護士などの法的支援を受けられない' },
    { id: '16.3.3', category: 16, text: 'トラブルや争いごとを抱えているが、解決に向けた相談先が分からない' },
    { id: '16.6.2', category: 16, text: '公的機関から適切な説明や対応を受けられず、問題が解決していない' },
    { id: '16.7.1', category: 16, text: '公的機関で、性別・年齢・障害を理由に昇進の機会が得られない' },
    { id: '16.7.2', category: 16, text: '暮らしの困りごとや要望が、国の政策に反映されていない' },
    { id: '16.9.1', category: 16, text: '自分または子どもの出生を公的に登録できていない' },
    { id: '16.10.1', category: 16, text: '人権を守る活動を理由に、暴力や不当な拘束を受けている' },
    { id: '17.3.2', category: 17, text: '海外で働く家族からの仕送りを受け取れず、生活費を確保できない' },
    { id: '17.6.1', category: 17, text: '自宅でインターネットを利用できない' },
];

const INDICATOR_BY_ID = new Map(INTAKE_INDICATORS.map((indicator) => [indicator.id, indicator]));

export function findIndicator(id: string): IntakeIndicator | undefined {
    return INDICATOR_BY_ID.get(id);
}

// 大項目ごとの選択肢(表示順は表の順)
export function indicatorsInCategory(category: number): IntakeIndicator[] {
    return INTAKE_INDICATORS.filter((indicator) => indicator.category === category);
}

// 選択肢を持つ大項目(相談フォームとサポーターのフィルターに出す順)
export const SELECTABLE_CATEGORIES: number[] = [...new Set(INTAKE_INDICATORS.map((indicator) => indicator.category))];

export function intakeCategoryLabel(category: number): string {
    return INTAKE_CATEGORIES[category] ?? `SDG ${category}`;
}

// next-intl はキーの「.」を入れ子として扱うので、メッセージキーは「_」区切りにする
export function indicatorMessageKey(id: string): string {
    return id.replace(/\./g, '_');
}

// 不正な ID・重複を落とし、上限で切る(API とフォームの両方で使う)
export function sanitizeIndicatorIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const ids = value.filter((id): id is string => typeof id === 'string' && INDICATOR_BY_ID.has(id));
    return [...new Set(ids)].slice(0, MAX_INDICATOR_SELECTIONS);
}

// 選んだ選択肢から大項目を決める(重複なし・選んだ順)。0 個なら「SDGsの隣のお困りごと」
export function categoriesFromIndicators(ids: string[]): number[] {
    const categories = [...new Set(ids.map((id) => findIndicator(id)?.category).filter((c): c is number => c !== undefined))];
    return categories.length > 0 ? categories : [NEIGHBOR_CATEGORY];
}

export function hasUrgentIndicator(ids: string[]): boolean {
    return ids.some((id) => findIndicator(id)?.urgent);
}

// AI に渡す文の組み立て(本番の gemini/analyze と体験ページ /trial で同じ並びにする):
// 「選んだ困りごと: A、B」→ 空行 → 自由記述。選択 0 個なら自由記述だけ
export function buildIntakeTextForAi(heading: string, indicatorTexts: string[], description: string): string {
    const selectedLine = indicatorTexts.length > 0 ? `${heading}: ${indicatorTexts.join('、')}` : '';
    return [selectedLine, description.trim()].filter(Boolean).join('\n\n');
}
