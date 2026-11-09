'use client'

// 団体からの招待(わたしのメールに届いたもの)。受けると団体の一員になり、支える側の画面が使える
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/client/api'
import { useReadyMe, useSession } from '@/components/app/SessionProvider'
import { Button, Card, Lead } from '@/components/app/ui'
import { canSupportAtAge } from '@/lib/domain/age'

type Invitation = { id: string; role: string; organizationName: string; expiresAt: string }

export function Invitations() {
  const t = useTranslations('support.invitations')
  const { refresh } = useSession()
  const me = useReadyMe()
  const allowed = !me || canSupportAtAge(me.person.age)
  const [items, setItems] = useState<Invitation[]>([])
  const load = () => apiFetch<{ invitations: Invitation[] }>('/api/me/invitations').then((d) => setItems(d.invitations)).catch(() => setItems([]))
  useEffect(() => { void load() }, [])
  const act = async (id: string, action: 'accept' | 'decline') => {
    await apiFetch(`/api/me/invitations/${id}`, { method: 'POST', json: { action, acceptSupporterTerms: action === 'accept' } }).catch(() => undefined)
    await load()
    if (action === 'accept') await refresh()
  }
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      {items.map((i) => (
        <Card key={i.id} tone="support" className="flex flex-col gap-2 border-2 border-dawn p-4">
          <span className="text-[14.5px] font-bold">{t('title', { name: i.organizationName })}</span>
          <Lead>{allowed ? t('lead') : t('underAge')}</Lead>
          <div className="flex gap-2">
            {allowed && <Button tone="support" variant="night" className="flex-1" onClick={() => void act(i.id, 'accept')}>{t('accept')}</Button>}
            <Button tone="support" variant="outline" onClick={() => void act(i.id, 'decline')}>{t('decline')}</Button>
          </div>
        </Card>
      ))}
    </section>
  )
}
