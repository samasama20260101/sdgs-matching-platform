// 団体のページが見つからないとき(載せるのをやめた団体・URL の誤り)。404 を返し、一覧へ戻る道を出す
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { AppHeader } from '@/components/app/AppShell'
import { Footer } from '@/components/app/Footer'
import { Heading, Lead, Screen } from '@/components/app/ui'

export default async function SupporterNotFound() {
  const t = await getTranslations('app.supporters.detail')
  return (
    <Screen>
      <AppHeader />
      <main className="flex flex-col gap-3 pb-6 pt-2">
        <Heading>{t('notFoundTitle')}</Heading>
        <Lead>{t('notFoundLead')}</Lead>
        <Link href="/supporters" className="flex min-h-[48px] items-center justify-center rounded-[16px] border-[1.5px] border-line-strong bg-paper px-4 text-t14 font-bold btn-track text-ink no-underline">
          {t('backToList')}
        </Link>
        <Footer />
      </main>
    </Screen>
  )
}
