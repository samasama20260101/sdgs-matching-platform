'use client'

// 運営｜相談の中身。運営への知らせ(Discord)のリンクから開く。読むだけ(指標を決めるのは「指標の仕分け」)
import { use, useCallback } from 'react'
import { apiFetch, ApiError } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { Link } from '@/i18n/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card, Chip, Lead, SectionLabel, Spinner } from '@/components/app/ui'

type AdminCase = {
  id: string
  displayId: string
  title: string
  status: string
  subjectType: 'PERSON' | 'COMPANY' | 'COMMUNITY' | 'NATION'
  subjectName: string | null
  urgent: boolean
  isMinor: boolean
  isSensitive: boolean
  sensitiveReasons: string[]
  areas: string[]
  indicators: { code: string; text: string; source: string; status: string; confidence: number | null; reason: string | null }[]
  aiSummary: string | null
  aiModel: string | null
  description: string
  since: string | null
  wish: string | null
  entryChannel: string
  entryCode: string | null
  proxyName: string | null
  proxyDisplayName: string | null
  locale: string | null
  country: string | null
  regionName: string | null
  city: string | null
  createdAt: string
  escalatedAt: string | null
  supporterResolvedAt: string | null
  resolvedAt: string | null
}
type Payload = {
  case: AdminCase
  offers: { id: string; kind: string; name: string; status: string; acceptedOrder: number | null; createdAt: string }[]
  referrals: { status: string; consentedAt: string | null; name: string; phone: string | null }[]
}

const STATUS: Record<string, string> = { OPEN: '申し出を待っている', MATCHED: '一緒に進めている', RESOLVED: '解決', CLOSED: '終了', CANCELLED: '取り消し' }
const SUBJECT: Record<string, string> = { PERSON: '個人', COMPANY: '会社', COMMUNITY: '地域', NATION: '国' }
const REASON: Record<string, string> = { INDICATOR: '選んだもの', MINOR: '18歳未満', AI: 'AI の判定', ADMIN: '運営' }
const SOURCE: Record<string, string> = { SELF: '本人', AI: 'AI', ADMIN: '運営' }
const INDICATOR_STATUS: Record<string, string> = { PROPOSED: '候補', CONFIRMED: '確定', REJECTED: '外した' }
const OFFER_STATUS: Record<string, string> = { PENDING: '返事待ち', INVITED: '招待', ACCEPTED: '選ばれた', DECLINED: '見送り', WITHDRAWN: '取り下げ', EXPIRED: '期限切れ' }
const REFERRAL_STATUS: Record<string, string> = { CONSENTED: '伝えてよい(まだ伝えていない)', CONTACTED: '伝えた', DONE: '済み', WITHDRAWN: '取り下げ' }
const LOCALE: Record<string, string> = { ja: '日本語', en: '英語', es: 'スペイン語' }

const jst = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }) : '—')

function entryText(c: AdminCase) {
  if (c.entryChannel === 'SHOP_CODE') return `相談所のコード${c.entryCode ? `(${c.entryCode})` : ''}`
  if (c.entryChannel === 'PROXY') return `団体の代理の登録(${c.proxyName ?? '—'}${c.proxyDisplayName ? `・呼び名 ${c.proxyDisplayName}` : ''})`
  return c.entryChannel === 'LENS' ? 'LENS' : 'アプリ'
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-mist">{label}</dt>
      <dd className="m-0 whitespace-pre-wrap">{children}</dd>
    </>
  )
}

function Inner({ id }: { id: string }) {
  const fetchCase = useCallback(() => apiFetch<Payload>(`/api/admin/cases/${id}`), [id])
  const { data, error } = useLoad(fetchCase)
  if (error) return <Lead>{error instanceof ApiError && error.status === 404 ? '相談が見つかりません。' : '読み込めませんでした。'}</Lead>
  if (!data) return <Spinner />
  const c = data.case
  const country = c.country && c.country !== 'JP' ? new Intl.DisplayNames(['ja'], { type: 'region' }).of(c.country) ?? c.country : null
  return (
    <>
      <Card tone="support" className="flex flex-col gap-2 p-4">
        <span className="text-t12 text-mist">{c.displayId} ・ {jst(c.createdAt)} に届いた</span>
        <span className="text-t16 font-bold leading-[1.5]">{c.title}</span>
        <span className="flex flex-wrap gap-1.5">
          <Chip color="night">{STATUS[c.status] ?? c.status}</Chip>
          <Chip>{SUBJECT[c.subjectType]}{c.subjectName ? `「${c.subjectName}」` : ''}</Chip>
          {c.urgent && <Chip color="coral">緊急</Chip>}
          {c.isSensitive && <Chip color="coral">機微({c.sensitiveReasons.map((r) => REASON[r] ?? r).join('・') || '—'})</Chip>}
          {c.isMinor && <Chip color="lamp">18歳未満</Chip>}
          {c.escalatedAt && <Chip color="outline">24時間申し出なし({jst(c.escalatedAt)})</Chip>}
        </span>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-t13">
          <Row label="分野">{c.areas.join(' / ')}</Row>
          <Row label="入口">{entryText(c)}</Row>
          <Row label="言語">{(c.locale && LOCALE[c.locale]) ?? c.locale ?? '—'}</Row>
          <Row label="地域">{[country, c.regionName, c.city].filter(Boolean).join(' ') || '—'}</Row>
          {c.supporterResolvedAt && <Row label="支え手の解決の報告">{jst(c.supporterResolvedAt)}</Row>}
          {c.resolvedAt && <Row label="解決">{jst(c.resolvedAt)}</Row>}
        </dl>
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>選んだもの・指標の候補</SectionLabel>
        {c.indicators.length === 0 && <Lead>ありません(自分の言葉だけで届いた相談)。</Lead>}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-t13">
          {c.indicators.map((i) => (
            <li key={`${i.source}${i.code}`} className="flex flex-wrap items-center gap-1.5">
              <Chip color={i.source === 'SELF' ? 'night' : 'outline'}>{SOURCE[i.source] ?? i.source}</Chip>
              <span>{i.code} {i.text}</span>
              <span className="text-mist">({INDICATOR_STATUS[i.status] ?? i.status}{i.source === 'AI' && i.reason ? `・${i.reason}` : ''})</span>
            </li>
          ))}
        </ul>
        <Link href="/admin/indicators" className="text-t13 text-night">指標の仕分けへ</Link>
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
        {c.aiSummary && (
          <>
            <SectionLabel>AI の要約{c.aiModel ? `(${c.aiModel})` : ''}</SectionLabel>
            <Lead>{c.aiSummary}</Lead>
          </>
        )}
        <SectionLabel>書いた内容</SectionLabel>
        <p className="m-0 whitespace-pre-wrap text-t14 leading-[1.75]">{c.description}</p>
        {(c.since || c.wish) && (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-t13">
            {c.since && <Row label="いつから">{c.since}</Row>}
            {c.wish && <Row label="どうしたいか">{c.wish}</Row>}
          </dl>
        )}
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>申し出({data.offers.length})</SectionLabel>
        {data.offers.length === 0 && <Lead>まだありません。</Lead>}
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-t13">
          {data.offers.map((o) => (
            <li key={o.id}>
              {o.name}({o.kind === 'ORGANIZATION' ? '団体' : '個人'}) ・ {OFFER_STATUS[o.status] ?? o.status}{o.acceptedOrder === 1 ? ' ・ 中心' : ''} ・ {jst(o.createdAt)}
            </li>
          ))}
        </ul>
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>つなぎ先(本人が「運営から伝えてよい」を選んだ窓口)</SectionLabel>
        {data.referrals.length === 0 && <Lead>ありません。</Lead>}
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-t13">
          {data.referrals.map((r, i) => (
            <li key={i}>
              {r.name}{r.phone ? `(${r.phone})` : ''} ・ {REFERRAL_STATUS[r.status] ?? r.status} ・ {jst(r.consentedAt)}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

export default function AdminCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AdminShell title="相談">
      <Inner id={id} />
    </AdminShell>
  )
}
