'use client'

// 運営｜メールアドレスの変更(#155)。古いアドレスでログインできなくなった支援団体のメンバーのアドレスを変える。
// 運営は先に団体の管理の人へ本人からの依頼か確かめる。相談者は確かめる手がかりがないので変えず、新しいアドレスで登録し直してもらう。
// 電話番号を確認した個人の支え手は、ログインの画面の「メールアドレスが使えなくなった方」から自分で入り直して変えられる
import { useState } from 'react'
import { apiFetch, ApiError } from '@/lib/client/api'
import { normalizeEmail } from '@/lib/domain/accountEmail'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button, Card, Chip, ErrorNote, Lead, TextField } from '@/components/app/ui'

type Member = { userId: string; displayName: string; displayId: string; role: 'OWNER' | 'MEMBER'; suspended: boolean }
type Org = { id: string; displayId: string; name: string; vettingStatus: string; members: Member[] }

const VETTING_LABELS: Record<string, string> = { APPLIED: '申し込み', INTERVIEW: '面談の調整中', APPROVED: '承認済み', REJECTED: '見送り', SUSPENDED: '停止' }

function MemberRow({ org, member }: { org: Org; member: Member }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    const address = normalizeEmail(email)
    if (!address) {
      setError('メールアドレスの形を確かめてください')
      return
    }
    if (!confirmed) {
      setError('団体の管理の人に確かめてから変えてください')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/admin/accounts/email', { method: 'POST', json: { organizationId: org.id, userId: member.userId, email: address, confirmedWithOrganization: true } })
      setDone(true)
      setOpen(false)
      setEmail('')
      setConfirmed(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '変えられませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-t14">
          {member.displayName || '—'} <span className="text-t12 text-mist">{member.displayId} ・ {member.role === 'OWNER' ? '管理' : 'メンバー'}</span>
          {member.suspended && <Chip color="coral" className="ml-2">止めている</Chip>}
        </span>
        {!open && !member.suspended && (
          <Button tone="support" variant="outline" className="min-h-[40px] px-3 text-t13" onClick={() => { setDone(false); setOpen(true) }}>メールアドレスを変える</Button>
        )}
      </div>
      {done && <p className="m-0 text-t12_5 font-bold text-leaf" role="status">変えました。新しいアドレスに届くコードでログインできることを、本人に伝えてください。</p>}
      {open && (
        <form className="flex flex-col gap-3 rounded-tool bg-steel-faint p-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <TextField label="新しいメールアドレス" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-night" />
            <span className="text-t13">「{org.name}」の管理の人に、本人からの依頼だと確かめました</span>
          </label>
          <div className="flex gap-2">
            <Button type="submit" tone="support" variant="night" disabled={busy} className="flex-1">変える</Button>
            <Button tone="support" variant="outline" onClick={() => { setOpen(false); setError(null) }}>やめる</Button>
          </div>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  )
}

export default function AccountsPage() {
  const [q, setQ] = useState('')
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    const query = q.trim()
    if (!query) return
    setBusy(true)
    setError(null)
    try {
      const data = await apiFetch<{ organizations: Org[] }>(`/api/admin/accounts?q=${encodeURIComponent(query)}`)
      setOrgs(data.organizations)
    } catch {
      setError('探せませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="メールアドレスの変更">
      <Lead>古いアドレスでログインできなくなった支援団体のメンバーのアドレスを変えます。先に団体の管理の人へ連絡し、本人からの依頼か確かめてください。相談者は本人と確かめる手がかりがないので変えず、新しいアドレスで登録し直していただきます。電話番号を確認した個人の支え手は、ログインの画面の「メールアドレスが使えなくなった方」から自分で入り直して変えられます。</Lead>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search() }}>
        <TextField label="支援団体の名前" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
        <Button type="submit" tone="support" variant="night" disabled={busy} className="self-end">探す</Button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      {orgs?.length === 0 && <Lead>見つかりませんでした(相談者の会社・地域は出しません)。</Lead>}
      {orgs?.map((org) => (
        <Card key={org.id} tone="support" className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-t15 font-bold">{org.name}</span>
            <span className="text-t12 text-mist">{org.displayId}</span>
            <Chip>{VETTING_LABELS[org.vettingStatus] ?? org.vettingStatus}</Chip>
          </div>
          {org.members.length === 0 ? <Lead>今いるメンバーがいません。</Lead> : org.members.map((m) => <MemberRow key={m.userId} org={org} member={m} />)}
        </Card>
      ))}
    </AdminShell>
  )
}
