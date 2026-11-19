'use client'

// 運営｜相談の中身。運営への知らせ(Discord)のリンクから開く。指標を決めるのは「指標の仕分け」。
// ここで直せるのは機微の扱いだけ(AI で分類できず機微にした相談などを、運営が確かめて外す・機微にする。#133)
import { use, useCallback, useState } from 'react'
import { apiFetch, ApiError } from '@/lib/client/api'
import { useLoad } from '@/lib/client/useLoad'
import { Link } from '@/i18n/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, ErrorNote, Lead, SectionLabel, Spinner } from '@/components/app/ui'

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
  // 分類に使う指標を選んだのは AI(#133 から)か本人(v2 の初め)か
  indicatorsBy: 'AI' | 'SELF'
  indicators: { code: string; text: string; source: string; status: string; confidence: number | null; reason: string | null }[]
  // 届けるときの AI の分類の記録。分類できなかった相談は null
  classification: { urgent: boolean; sensitive: boolean; model: string | null; generatedAt: string | null } | null
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
  referrals: { status: string; consentedAt: string | null; name: string; phone: string | null; website: string | null }[]
  suggestions: { rank: number; reason: string | null; method: string; name: string; phone: string | null; website: string | null }[]
}

const STATUS: Record<string, string> = { OPEN: '申し出を待っている', MATCHED: '一緒に進めている', RESOLVED: '解決', CLOSED: '終了', CANCELLED: '取り消し' }
const SUBJECT: Record<string, string> = { PERSON: '個人', COMPANY: '会社', COMMUNITY: '地域', NATION: '国' }
const REASON: Record<string, string> = { WORDS: '書いた言葉', MINOR: '18歳未満', INDICATOR: '指標の印', AI: 'AI の判定', AI_UNAVAILABLE: 'AI で分類できなかった', ADMIN: '運営が機微にした', ADMIN_CLEARED: '運営が外した' }
const SOURCE: Record<string, string> = { SELF: '相談者', AI: 'AI', ADMIN: '運営' }
const INDICATOR_STATUS: Record<string, string> = { PROPOSED: '候補', CONFIRMED: '確定', REJECTED: '外した' }
const OFFER_STATUS: Record<string, string> = { PENDING: '返事待ち', INVITED: '招待', ACCEPTED: '選ばれた', DECLINED: '見送り', WITHDRAWN: '取り下げ', EXPIRED: '期限切れ' }
const REFERRAL_STATUS: Record<string, string> = { CONSENTED: '伝えてよい(まだ伝えていない)', CONTACTED: '伝えた', DONE: '済み', WITHDRAWN: '取り下げ' }
const LOCALE: Record<string, string> = { ja: '日本語', en: '英語', es: 'スペイン語' }

const jst = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }) : '—')

function entryText(c: AdminCase) {
  if (c.entryChannel === 'SHOP_CODE') return `相談所のコード${c.entryCode ? `(${c.entryCode})` : ''}`
  if (c.entryChannel === 'PROXY') return `支援団体の代理の登録(${c.proxyName ?? '—'}${c.proxyDisplayName ? `・呼び名 ${c.proxyDisplayName}` : ''})`
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

// 機微の扱いを運営が直す。外すと、面談済みの支援団体のメンバーなら2つ目の確認なしで中身を読め、会社・地域の相談は個人の支え手にも出る
function SensitivityPanel({ c, onDone }: { c: AdminCase; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = async (sensitive: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/cases/${c.id}`, { method: 'PATCH', json: { sensitive } })
      await onDone()
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'CONFLICT' ? 'ほかの操作と重なりました。読み直してから、もう一度選んでください。' : '直せませんでした。')
    } finally {
      setBusy(false)
    }
  }
  const unavailable = c.sensitiveReasons.includes('AI_UNAVAILABLE')
  return (
    <Card tone="support" className="flex flex-col gap-2 p-4">
      <SectionLabel>機微の扱い</SectionLabel>
      <span className="text-t13">
        いまは{c.isSensitive ? '機微として扱っています' : '機微として扱っていません'}
        {c.sensitiveReasons.length > 0 ? `(理由: ${c.sensitiveReasons.map((r) => REASON[r] ?? r).join('・')})` : ''}。
      </span>
      {unavailable && (
        <span className="text-t12_5 leading-[1.7] text-ink-soft">
          届けたときに AI で分類できなかった(使えない・時間切れ・壊れた応答)ので、念のため機微にしました。本文を読んで、命・暴力・性・虐待・依存・偏見を受けやすい病気にかかわらなければ外してください。毎日の処理で分類し直しても、機微は自動では外れません。
        </span>
      )}
      {c.isMinor && <span className="text-t12_5 leading-[1.7] text-ink-soft">18歳未満の相談は、機微を外しても、面談済みの支援団体の2つ目の確認を通った人にだけ見えます。</span>}
      <span className="text-t12 leading-[1.7] text-mist">機微な相談は、面談済みの支援団体の、2つ目の確認を通った人にだけ中身が見え、個人の支え手には出ません。</span>
      <ErrorNote>{error}</ErrorNote>
      {c.isSensitive ? (
        <Button tone="support" variant="outline" disabled={busy} className="self-start" onClick={() => void set(false)}>機微を外す</Button>
      ) : (
        <Button tone="support" variant="outline" disabled={busy} className="self-start" onClick={() => void set(true)}>機微として扱う</Button>
      )}
    </Card>
  )
}

function Inner({ id }: { id: string }) {
  const fetchCase = useCallback(() => apiFetch<Payload>(`/api/admin/cases/${id}`), [id])
  const { data, error, reload } = useLoad(fetchCase)
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

      <SensitivityPanel c={c} onDone={reload} />

      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>指標(分類)</SectionLabel>
        <span className="text-t12_5 leading-[1.7] text-mist">
          {c.indicatorsBy === 'AI'
            ? c.classification
              ? `届けたときに AI が選びました(${c.classification.model ?? 'モデル不明'}・${jst(c.classification.generatedAt)})。AI の判定: ${c.classification.urgent ? '緊急' : '緊急でない'}・${c.classification.sensitive ? '機微' : '機微でない'}。`
              : '届けたときに AI で分類できませんでした。毎日の処理(JST 2:00)で分類し直します。'
            : '相談者が選んだもの(困りごとを選ぶ段があった頃の相談)と、AI の候補です。'}
        </span>
        {c.indicators.length === 0 && <Lead>ありません(分野は「SDGsの隣のお困りごと」)。</Lead>}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-t13">
          {c.indicators.map((i) => (
            <li key={`${i.source}${i.code}`} className="flex flex-wrap items-center gap-1.5">
              <Chip color={i.source === 'AI' ? 'outline' : 'night'}>{SOURCE[i.source] ?? i.source}</Chip>
              <span>{i.code} {i.text}</span>
              <span className="text-mist">({INDICATOR_STATUS[i.status] ?? i.status}{i.source === 'AI' && i.reason ? `・${i.reason}` : ''})</span>
            </li>
          ))}
        </ul>
        <Link href="/admin/indicators" className="text-t13 text-night">指標の仕分けへ</Link>
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
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
              {o.name}({o.kind === 'ORGANIZATION' ? '支援団体' : '個人の支え手'}) ・ {OFFER_STATUS[o.status] ?? o.status}{o.acceptedOrder === 1 ? ' ・ 中心' : ''} ・ {jst(o.createdAt)}
            </li>
          ))}
        </ul>
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>相談者に提案した支援団体</SectionLabel>
        {data.suggestions.length === 0 && <Lead>まだありません(届けた直後に作ります。合う団体がないときも出ません)。</Lead>}
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-t13">
          {data.suggestions.map((s) => (
            <li key={s.rank}>
              {s.rank}. {s.name}{s.phone ? `(${s.phone})` : ''} ・ {s.method === 'AI' ? 'AI が選んだ' : '決まりで選んだ'}{s.reason ? ` ・ ${s.reason}` : ''}
            </li>
          ))}
        </ul>
      </Card>

      <Card tone="support" className="flex flex-col gap-2 p-4">
        <SectionLabel>つなぎ先(相談者が「運営から伝えてもらう」を選んだ団体)</SectionLabel>
        {data.referrals.length === 0 && <Lead>ありません。</Lead>}
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-t13">
          {data.referrals.map((r, i) => (
            <li key={i}>
              {r.name}{r.phone ? `(${r.phone})` : ''} ・ {REFERRAL_STATUS[r.status] ?? r.status} ・ {jst(r.consentedAt)}
              {r.website && <> ・ <a href={r.website} target="_blank" rel="noopener noreferrer">サイト</a></>}
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
