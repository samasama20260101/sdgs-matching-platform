'use client'

// どの立場で支えるか(盤 22「どの立場で支えますか」)。団体の一員(複数可)か、個人として。選んだものは端末に覚えておく
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useReadyMe } from '@/components/app/SessionProvider'
import { cx } from '@/components/app/ui'
import { useStoredValue } from '@/lib/client/storedValue'
import { canSupportAtAge } from '@/lib/domain/age'

export type FaceOption = { key: string; label: string; kind: 'ORGANIZATION' | 'INDIVIDUAL'; approved: boolean; role?: 'OWNER' | 'MEMBER'; organizationId?: string; coordinator?: boolean }

const STORAGE_KEY = 'samasama.face'

export function useFace() {
  const me = useReadyMe()
  const options = useMemo<FaceOption[]>(() => {
    // 18歳未満の人には立場を出さない(相談する側の団体は me.faces にそのまま残る)
    if (!me || !canSupportAtAge(me.person.age)) return []
    const orgs = me.faces.organizations
      .filter((o) => !['REJECTED', 'SUSPENDED'].includes(o.vettingStatus))
      .map((o) => ({ key: `org:${o.organizationId}`, label: o.organizationName, kind: 'ORGANIZATION' as const, approved: o.vettingStatus === 'APPROVED', role: o.role, organizationId: o.organizationId, coordinator: o.isCoordinator }))
    const ind = me.faces.individual ? [{ key: 'individual', label: me.faces.individual.realName, kind: 'INDIVIDUAL' as const, approved: me.faces.individual.status === 'ACTIVE' }] : []
    return [...orgs, ...ind]
  }, [me])
  // 覚えた立場が今の選択肢にないときは、承認済みの最初の立場(なければ最初の立場)にする
  const [stored, choose] = useStoredValue(STORAGE_KEY)
  const current = options.find((o) => o.key === stored) ?? options.find((o) => o.approved) ?? options[0] ?? null
  return { options, current, choose }
}

export function FacePicker({ options, current, onChoose }: { options: FaceOption[]; current: FaceOption | null; onChoose: (key: string) => void }) {
  const t = useTranslations('support.face')
  if (options.length <= 1) return null
  return (
    <div role="radiogroup" aria-label={t('label')} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={current?.key === o.key}
          onClick={() => onChoose(o.key)}
          className={cx('min-h-[40px] rounded-tool px-3 text-[13px] font-bold', current?.key === o.key ? 'bg-night text-white' : 'border border-line bg-paper text-ink-soft')}
        >
          {o.kind === 'INDIVIDUAL' ? t('asIndividual', { name: o.label }) : o.label}
          {!o.approved && o.kind === 'ORGANIZATION' && <span className="ml-1 text-[11px] opacity-80">{t('pending')}</span>}
        </button>
      ))}
    </div>
  )
}
