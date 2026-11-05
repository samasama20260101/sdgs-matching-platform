// 団体の活動地域の決まり(純粋関数。API・支える側の顔・公開の団体ページで同じものを使う)。
//   - 団体が活動地域を登録していれば、それだけを使う(全国か、地域の一覧)
//   - 登録していなければ、申し込みのときの都道府県(団体の所在地)を使う
//   - 保存できるのは、全国か、その国の地域 1 つ以上(重複なし・上限まで)
export const SERVICE_AREAS_MAX = 100

export type ServiceAreaRow = { region_code: string | null; is_nationwide: boolean }
export type ServiceAreas = { nationwide: boolean; regionCodes: string[] }

const REGION_CODE = /^[A-Z]{2}-[0-9A-Z]{1,3}$/

export function effectiveServiceAreas(rows: ServiceAreaRow[], prefecture: string | null): ServiceAreas & { registered: boolean } {
  if (rows.length > 0) {
    const codes = rows.filter((r) => !r.is_nationwide && r.region_code).map((r) => r.region_code as string)
    return { registered: true, nationwide: rows.some((r) => r.is_nationwide), regionCodes: [...new Set(codes)] }
  }
  return { registered: false, nationwide: false, regionCodes: prefecture && REGION_CODE.test(prefecture) ? [prefecture] : [] }
}

export type ServiceAreaInputError = 'EMPTY' | 'UNKNOWN_REGION' | 'TOO_MANY'

// allowed: その国の地域のコード(並び順のとおり)。保存する一覧はこの順にそろえる
export function normalizeServiceAreaInput(
  input: { nationwide: boolean; regionCodes: string[] },
  allowed: readonly string[],
): { ok: true; value: ServiceAreas } | { ok: false; reason: ServiceAreaInputError } {
  if (input.nationwide) return { ok: true, value: { nationwide: true, regionCodes: [] } }
  const picked = new Set(input.regionCodes)
  if (picked.size === 0) return { ok: false, reason: 'EMPTY' }
  if (picked.size > SERVICE_AREAS_MAX) return { ok: false, reason: 'TOO_MANY' }
  const known = new Set(allowed)
  if ([...picked].some((c) => !known.has(c))) return { ok: false, reason: 'UNKNOWN_REGION' }
  return { ok: true, value: { nationwide: false, regionCodes: allowed.filter((c) => picked.has(c)) } }
}

// 国ごとの地域の段(regions.level)。日本は都道府県、ほかの国は州・県
export function regionLevelFor(country: string): 'prefecture' | 'province' {
  return country === 'JP' ? 'prefecture' : 'province'
}
