// 国の一覧(ISO 3166-1 alpha-2)。名前は画面の言語で Intl.DisplayNames から出す(翻訳の表を持たない)。
// 世界中からの相談の登録と支援への参加を受ける(11/5 定例)。先頭は日本、次にスペイン語が公用語の国。
export const PRIORITY_COUNTRIES = ['JP', 'ES', 'MX', 'AR', 'CO', 'PE', 'CL', 'US', 'PH', 'ID', 'VN', 'BD'] as const

export const ALL_COUNTRIES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ')

export function isCountryCode(value: string): boolean {
  return ALL_COUNTRIES.includes(value)
}

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function sortedCountries(locale: string): { code: string; name: string }[] {
  const priority = new Set<string>(PRIORITY_COUNTRIES)
  const rest = ALL_COUNTRIES.filter((c) => !priority.has(c))
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  return [...PRIORITY_COUNTRIES.map((code) => ({ code, name: countryName(code, locale) })), ...rest]
}
