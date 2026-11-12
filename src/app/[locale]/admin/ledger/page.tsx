'use client'

// 運営｜指標の台帳(読むだけ)。直すのは代表の指標一覧(Excel)で、取り込みは scripts/ledger/import-org-intake.ts
import { useState } from 'react'
import { INTAKE_INDICATORS } from '@/lib/constants/intakeIndicators'
import { COMMUNITY_INTAKE_INDICATORS, COMPANY_INTAKE_INDICATORS } from '@/lib/constants/orgIntakeIndicators.generated'
import { EXTRA_SENSITIVE_INDICATORS } from '@/lib/domain/sensitivity'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card, Chip, cx, Lead } from '@/components/app/ui'

const SETS = [['PERSON', '個人', INTAKE_INDICATORS], ['COMPANY', '会社', COMPANY_INTAKE_INDICATORS], ['COMMUNITY', '地域', COMMUNITY_INTAKE_INDICATORS]] as const

export default function LedgerPage() {
  const [tab, setTab] = useState<(typeof SETS)[number][0]>('PERSON')
  const set = SETS.find((s) => s[0] === tab) ?? SETS[0]
  return (
    <AdminShell title="指標の台帳">
      <Lead>相談フォームの選択肢と、緊急・機微の印です。機微の印は運営に確かめてもらう前の案です(src/lib/domain/sensitivity.ts)。</Lead>
      <div className="flex gap-1.5">
        {SETS.map(([k, label, list]) => <button key={k} type="button" onClick={() => setTab(k)} className={cx('min-h-[44px] rounded-full px-3 text-t12_5 font-bold', tab === k ? 'bg-night text-white' : 'border border-line bg-paper')}>{label} {list.length}</button>)}
      </div>
      <Card tone="support" className="flex flex-col p-2">
        {set[2].map((o) => {
          const urgent = 'urgent' in o && o.urgent
          const sensitive = urgent || EXTRA_SENSITIVE_INDICATORS.includes(o.id)
          return (
            <div key={o.id} className="flex items-start gap-2 border-t border-line px-2 py-2 text-t13 first:border-t-0">
              <span className="w-14 shrink-0 font-mono text-t12 text-mist">{o.id}</span>
              <span className="flex-1">{o.text}</span>
              {urgent && <Chip color="coral">緊急</Chip>}
              {sensitive && <Chip>機微</Chip>}
            </div>
          )
        })}
      </Card>
    </AdminShell>
  )
}
