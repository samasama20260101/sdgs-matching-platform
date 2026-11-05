'use client'

// 相談する｜ホーム(盤 13 の前): 相談ごとの「いま」と、相談を書く入口
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AppFrame } from '@/components/app/AppShell'
import { RequireMe } from '@/components/app/RequireMe'
import { MyCases } from '@/components/consult/MyCases'
import { Heading, Lead } from '@/components/app/ui'

export default function HomePage() {
  const t = useTranslations('app.home')
  return (
    <RequireMe>
      {(me) => (
        <AppFrame>
          <div className="flex flex-col gap-1 px-1">
            <Heading level={2}>{t('hello', { name: me.person.displayName })}</Heading>
            <Lead>{t('lead')}</Lead>
          </div>
          <Link href="/consult/new" className="flex min-h-[56px] items-center justify-center rounded-[16px] bg-lamp text-[16px] font-bold text-ink no-underline">
            {t('write')}
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/consult/org?subject=COMPANY" className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-line bg-paper text-[13.5px] font-bold text-ink no-underline">{t('asCompany')}</Link>
            <Link href="/consult/org?subject=COMMUNITY" className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-line bg-paper text-[13.5px] font-bold text-ink no-underline">{t('asCommunity')}</Link>
          </div>
          <MyCases />
        </AppFrame>
      )}
    </RequireMe>
  )
}
