// 運営への知らせの文面(純粋関数)。Discord は外のサービスなので、載せるものを絞る:
//   - 載せる: 番号・主体(会社・地域は団体名)・緊急/機微/18歳未満の印・分野(大項目)・選んだもの・入口・言語・国・運営の画面へのリンク
//   - 載せない: 本文・呼び名・都道府県より細かい地域。機微な相談と18歳未満の相談は、選んだものも載せない(分野まで)
// 中身はリンク先の運営の画面(2つ目の確認まで済んだログインだけが開ける)で読む(2026-11-06 岡本さん「URL と相談の類をもう少し細かく」)
import sdgsJa from '../../../messages/ja/sdgs.json'
import supportJa from '../../../messages/ja/support.json'
import { INTAKE_CATEGORIES, NEIGHBOR_CATEGORY } from '@/lib/constants/intakeIndicators'
import { optionsFor, shortTitle, type SubjectType } from '@/lib/domain/intake'

export type OpsCaseRef = { displayId: string; caseId: string }

export type OpsEvent =
  | (OpsCaseRef & {
      kind: 'NEW_CASE'
      subjectType: SubjectType
      // 会社・地域として相談した団体の名前(個人の相談では null)
      subjectName: string | null
      urgent: boolean
      sensitive: boolean
      minor: boolean
      indicators: string[]
      entryChannel: string
      entryCode: string | null
      // 代理の登録をした団体の名前
      proxyName: string | null
      locale: string | null
      country: string | null
    })
  | (OpsCaseRef & { kind: 'REFERRAL_CONSENT'; entryName: string; entryPhone: string | null })
  | {
      kind: 'ORG_APPLICATION'
      organizationId: string
      organizationDisplayId: string
      name: string
      orgType: string
      country: string | null
      regionName: string | null
    }
  | { kind: 'UNMATCHED'; cases: OpsCaseRef[] }

const SUBJECT_LABEL: Record<SubjectType, string> = { PERSON: '個人', COMPANY: '会社', COMMUNITY: '地域', NATION: '国' }
const LOCALE_LABEL: Record<string, string> = { ja: '日本語', en: '英語', es: 'スペイン語' }
const AREA_LABELS = sdgsJa.area as Record<string, Record<string, string>>
const ORG_TYPE_LABELS = supportJa.orgType as Record<string, string>
// 選んだものは1つ 30 字までに縮め、3つまで並べる
const PICKED_MAX_CHARS = 30
// 申し出のない相談の知らせに並べる番号の数
const UNMATCHED_LIST_MAX = 10

export function adminCaseUrl(origin: string, caseId: string): string {
  return `${origin.replace(/\/$/, '')}/admin/cases/${caseId}`
}

export function adminVettingUrl(origin: string, organizationDisplayId: string): string {
  return `${origin.replace(/\/$/, '')}/admin/vetting#${organizationDisplayId}`
}

// 分野(大項目)の名前。会社・地域は主体ごとの名前、個人と、主体ごとの名前がない番号は個人の大項目の名前。
// 何も選ばずに届いた相談は「SDGsの隣のお困りごと」
export function areaLabels(subject: SubjectType, indicators: string[]): string[] {
  const byId = new Map(optionsFor(subject).map((o) => [o.id, o.category]))
  const categories = [...new Set(indicators.map((id) => byId.get(id)).filter((c): c is number => typeof c === 'number'))]
  if (categories.length === 0) return [INTAKE_CATEGORIES[NEIGHBOR_CATEGORY]]
  return categories.map((c) => (subject !== 'PERSON' ? AREA_LABELS[subject]?.[String(c)] : undefined) ?? INTAKE_CATEGORIES[c] ?? String(c))
}

function pickedLabels(subject: SubjectType, indicators: string[]): string[] {
  const byId = new Map(optionsFor(subject).map((o) => [o.id, o.text]))
  return indicators.map((id) => byId.get(id)).filter((t): t is string => Boolean(t)).map((t) => (t.length > PICKED_MAX_CHARS ? `${t.slice(0, PICKED_MAX_CHARS)}…` : t))
}

function entryLabel(channel: string, code: string | null, proxyName: string | null): string {
  if (channel === 'SHOP_CODE') return code ? `相談所のコード(${code})` : '相談所のコード'
  if (channel === 'PROXY') return proxyName ? `団体の代理の登録(${proxyName})` : '団体の代理の登録'
  if (channel === 'LENS') return 'LENS'
  return 'アプリ'
}

function countryLabel(country: string | null): string | null {
  if (!country || country === 'JP') return null
  try {
    return new Intl.DisplayNames(['ja'], { type: 'region' }).of(country) ?? country
  } catch {
    return country
  }
}

export function formatOpsEvent(event: OpsEvent, origin: string): string {
  switch (event.kind) {
    case 'NEW_CASE': {
      const marks = [event.urgent ? '緊急' : null, event.sensitive ? '機微' : null, event.minor ? '18歳未満' : null].filter(Boolean).join('・')
      const subject = event.subjectName ? `${SUBJECT_LABEL[event.subjectType]}「${shortTitle(event.subjectName)}」` : SUBJECT_LABEL[event.subjectType]
      const hidden = event.sensitive || event.minor
      const picked = pickedLabels(event.subjectType, event.indicators)
      const about = [`入口: ${entryLabel(event.entryChannel, event.entryCode, event.proxyName)}`]
      if (event.locale && event.locale !== 'ja') about.push(`言語: ${LOCALE_LABEL[event.locale] ?? event.locale}`)
      const country = countryLabel(event.country)
      if (country) about.push(`国: ${country}`)
      return [
        `新しい相談 ${event.displayId}(${subject})${marks ? ` ${marks}` : ''}`,
        `分野: ${areaLabels(event.subjectType, event.indicators).join(' / ')}`,
        hidden ? '選んだもの: 機微な相談なので載せません(リンク先で見てください)' : `選んだもの: ${picked.length > 0 ? picked.join(' / ') : 'なし(自分の言葉だけ)'}`,
        about.join(' ・ '),
        adminCaseUrl(origin, event.caseId),
      ].join('\n')
    }
    case 'REFERRAL_CONSENT':
      return [
        `つなぎ先に伝えてよいと選ばれた相談があります ${event.displayId}`,
        `伝える先: ${event.entryName}${event.entryPhone ? `(${event.entryPhone})` : ''}`,
        adminCaseUrl(origin, event.caseId),
      ].join('\n')
    case 'ORG_APPLICATION': {
      const where = [event.regionName, countryLabel(event.country)].filter(Boolean).join('・')
      return [
        `支え手の団体の申し込みが届きました ${event.organizationDisplayId}`,
        `${shortTitle(event.name)}(${ORG_TYPE_LABELS[event.orgType] ?? event.orgType}${where ? `・${where}` : ''})`,
        adminVettingUrl(origin, event.organizationDisplayId),
      ].join('\n')
    }
    case 'UNMATCHED': {
      const shown = event.cases.slice(0, UNMATCHED_LIST_MAX)
      const rest = event.cases.length - shown.length
      return [
        `24時間申し出のない相談が ${event.cases.length} 件あります`,
        ...shown.map((c) => `${c.displayId} ${adminCaseUrl(origin, c.caseId)}`),
        ...(rest > 0 ? [`ほか ${rest} 件`] : []),
      ].join('\n')
    }
  }
}

// 知らせの種類ごとの行き先。相談のこと(新しい相談・つなぎ先の同意・申し出のない相談)は Discord の「新着sos」、
// 団体の申し込みは「サポーター申請」に流す。申し込み用の Webhook がなければ相談のほうに流す
export type OpsWebhookEnv = { DISCORD_OPS_WEBHOOK_URL?: string; DISCORD_OPS_APPLICATION_WEBHOOK_URL?: string }

export function opsWebhookFor(kind: OpsEvent['kind'], env: OpsWebhookEnv): string | null {
  const cases = env.DISCORD_OPS_WEBHOOK_URL?.trim() || null
  if (kind === 'ORG_APPLICATION') return env.DISCORD_OPS_APPLICATION_WEBHOOK_URL?.trim() || cases
  return cases
}
