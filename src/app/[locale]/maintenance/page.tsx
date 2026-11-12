import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Mark } from '@/components/app/Mark'
import { Card, Chip, Heading, Lead } from '@/components/app/ui'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: 'common.maintenance' })
    return {
        title: t('metaTitle'),
        robots: {
            index: false,
            follow: false,
        },
    }
}

export default async function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: 'common.maintenance' })
    return (
        <div className="min-h-dvh bg-kinari text-ink">
            <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center gap-4 px-4 py-10">
                <span className="flex items-center gap-2.5">
                    <Mark />
                    <span className="font-heading text-t16 font-bold">{t('brand')}</span>
                </span>
                <Card className="flex flex-col gap-3 p-5">
                    <Chip color="lamp" className="self-start">{t('badge')}</Chip>
                    <Heading>{t('title')}</Heading>
                    <Lead>{t('body')}</Lead>
                    <div className="flex flex-col gap-1 rounded-tool bg-kinari-deep p-3">
                        <span className="text-t13 font-bold">{t('noteTitle')}</span>
                        <span className="text-t13 leading-[1.75] text-ink-soft">{t('noteBody')}</span>
                    </div>
                </Card>
            </main>
        </div>
    )
}
