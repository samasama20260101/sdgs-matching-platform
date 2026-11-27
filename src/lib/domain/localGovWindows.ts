// 相談に合う支援団体の提案に出す、地域の公的な窓口(自治体の窓口と、都道府県・国が地域ごとに置く窓口)の種類(#173、純粋)。
// 11/19 定例では「市区町村まで分からないと提案しにくい」ので出さないと決めたが、10/30 に市区町村まで聞くと代表と
// 合意済みだったため、2026-11-27 に岡本さんが見直した。相談者の市区町村(と都道府県)の窓口だけを出す。
// 種類の名前は directory_entries.categories と同じ(正本は directory-data の mappings/window-types.yaml)。
// 説明は AI が相談と見比べるために渡す(窓口には団体の調べ = consult_summary が無いため)。

// 提案 3 つのうち、地域の公的な窓口は 1 つまで。民間の支援団体の後ろに置く
// (行政は制度の枠で動き、NPO はその枠の外を救う。両方がいることに意味がある = AGENTS.md のサービスの考え方)
export const LOCAL_GOV_WINDOW_LIMIT = 1
// AI に見せる地域の公的な窓口の数(種類ごとに 1 つにしたあと。種類は 30 ほどで、ふつうはすべて見せられる)
export const LOCAL_GOV_AI_LIMIT = 20

export const LOCAL_GOV_WINDOW_TYPES: Readonly<Record<string, string>> = {
  // 市区町村の窓口
  SELF_RELIANCE_SUPPORT: '自立相談支援機関。仕事・お金・住まいなど、暮らしに困ったときの相談(生活困窮者自立支援制度)',
  WELFARE_OFFICE: '福祉事務所。生活保護など、暮らしが立ち行かないときの相談',
  COMMUNITY_GENERAL_SUPPORT_CENTER: '地域包括支援センター。高齢者の介護・暮らしの総合相談(本人と家族)',
  CHILD_FAMILY_CENTER: 'こども家庭センター。子育て・妊娠・家庭の相談',
  MUNICIPAL_SOCIAL_WELFARE_COUNCIL: '市区町村の社会福祉協議会。暮らしの困りごとの相談や、お金の貸し付けの相談',
  DISABILITY_CORE_CONSULTATION_CENTER: '基幹相談支援センター。障害のある人と家族の相談',
  HIKIKOMORI_MUNICIPAL_WINDOW: 'ひきこもりの相談窓口(本人と家族)',
  WOMEN_DV_MUNICIPAL_WINDOW: '女性相談・DV 相談の窓口',
  FOREIGN_RESIDENT_CONSULTATION: '外国人住民の相談窓口(暮らし・手続き・言葉)',
  COMPREHENSIVE_WELFARE_CONSULTATION: '福祉の総合相談窓口。分野を問わず、どこに相談すればよいか分からない困りごとを受ける',
  CONSUMER_CENTER: '消費生活センター。契約・買い物・悪質な勧誘や詐欺のトラブルの相談',
  // 都道府県などが地域ごとに置く窓口
  CHILD_GUIDANCE_CENTER: '児童相談所。子どもの虐待・養育・非行の相談',
  SPOUSAL_VIOLENCE_CENTER: '配偶者暴力相談支援センター。配偶者やパートナーからの暴力の相談',
  WOMEN_SUPPORT_CENTER: '女性相談支援センター。DV・性暴力・生活に困った女性の相談',
  MENTAL_HEALTH_WELFARE_CENTER: '精神保健福祉センター。こころの病気や依存症の相談',
  MENTAL_HEALTH_DIAL_WINDOW: 'こころの健康相談の電話窓口',
  HIKIKOMORI_SUPPORT_CENTER: 'ひきこもり地域支援センター(本人と家族)',
  YOUTH_SUPPORT_STATION: '地域若者サポートステーション。15〜49歳の、働くことに踏み出す相談',
  PREF_YOUTH_CONSULTATION: '若者の総合相談',
  PREF_HOUSING_LOSS_SUPPORT: '住まいを失った人・失いそうな人の相談',
  PREF_FOREIGN_RESIDENT_CONSULTATION: '外国人の相談',
  PREF_SUICIDE_PREVENTION: '死にたい気持ち・こころの電話相談',
  PREF_SINGLE_PARENT_SUPPORT: 'ひとり親家庭の相談',
  PREF_CRIME_VICTIM_SUPPORT: '犯罪被害者の相談',
  PREF_SEXUAL_VIOLENCE_ONESTOP: '性犯罪・性暴力の被害の相談(ワンストップ支援センター)',
  PREF_DEVELOPMENTAL_DISABILITY_CENTER: '発達障害者支援センター',
  PREF_LABOR_CONSULTATION: '労働相談(解雇・賃金の未払い・ハラスメントなど)',
  PREF_EMPLOYMENT_SUPPORT: '仕事探しの相談',
  PREF_CHILD_RIGHTS_CONSULTATION: '子どもの権利・子ども向けの相談',
  PREF_EDUCATION_CONSULTATION: '教育相談・いじめの相談',
  PREF_OTHER_SPECIALIZED: '都道府県の専門の相談窓口',
}

export const LOCAL_GOV_WINDOW_CATEGORIES = Object.keys(LOCAL_GOV_WINDOW_TYPES)

// 窓口の説明(種類が複数なら最初に当たったもの)。種類が一覧に無ければ null
export function localGovWindowDescription(categories: readonly string[]): string | null {
  for (const c of categories) {
    const text = LOCAL_GOV_WINDOW_TYPES[c]
    if (text) return text
  }
  return null
}

// 相談者の市区町村のコードの並び(政令市の区を選んだ人は、区と市の両方。市の窓口は区の人も受けるため)
export function municipalityCodesOf(code: string | null, parentCode: string | null): string[] {
  if (!code) return []
  return parentCode && parentCode !== code ? [code, parentCode] : [code]
}

// 政令市の区の名前から市の名前を除く(「横浜市港北区」→「港北区」)。窓口の名前に入っている区の名前と見比べるため
export function shortWardName(wardName: string, cityName: string): string {
  return cityName && wardName.startsWith(cityName) ? wardName.slice(cityName.length) : wardName
}
