// ナミアの紹介(公開・ログイン不要、#161)。フッターの「合同会社samasama」の後ろから開く。
// コーポレートサイトのトップと同じ絵と一文だけを置く
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { DocShell } from '@/components/app/DocShell'
import { NamiaGlow } from '@/components/app/NamiaGlow'
import { Heading } from '@/components/app/ui'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'app.namia' })
  return { title: `${t('title')} | 明日もsamasama`, description: t('caption') }
}

export default async function NamiaPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'app.namia' })
  return (
    <DocShell>
      <section className="flex flex-col items-center gap-5 px-1 pt-4 text-center">
        <Heading>{t('title')}</Heading>
        <NamiaGlow size={220} alt={t('alt')} />
        <p className="m-0 text-t13 leading-[1.8] tracking-[0.04em] text-mist">{t('caption')}</p>
      </section>
    </DocShell>
  )
}
