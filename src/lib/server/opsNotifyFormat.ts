// 運営への知らせの文面(純粋関数)。相談の中身・呼び名・地域は載せない
export type OpsEvent =
  | { kind: 'NEW_CASE'; displayId: string; subjectType: string; urgent: boolean; sensitive: boolean }
  | { kind: 'REFERRAL_CONSENT'; displayId: string }
  | { kind: 'ORG_APPLICATION'; organizationDisplayId: string }
  | { kind: 'UNMATCHED'; count: number }

const SUBJECT_LABEL: Record<string, string> = { PERSON: '個人', COMPANY: '会社', COMMUNITY: '地域', NATION: '国' }

export function formatOpsEvent(event: OpsEvent): string {
  switch (event.kind) {
    case 'NEW_CASE': {
      const marks = [event.urgent ? '緊急' : null, event.sensitive ? '機微' : null].filter(Boolean).join('・')
      return `新しい相談 ${event.displayId}(${SUBJECT_LABEL[event.subjectType] ?? event.subjectType})${marks ? ` ${marks}` : ''}`
    }
    case 'REFERRAL_CONSENT':
      return `つなぎ先に伝えてよいと選ばれた相談があります ${event.displayId}`
    case 'ORG_APPLICATION':
      return `支え手の団体の申し込みが届きました ${event.organizationDisplayId}`
    case 'UNMATCHED':
      return `24時間申し出のない相談が ${event.count} 件あります`
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
