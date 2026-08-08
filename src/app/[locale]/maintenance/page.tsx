import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

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
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 px-6 py-12">
            <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
                <div className="w-full rounded-3xl border border-blue-100 bg-white/90 p-8 shadow-sm">
                    <div className="mb-6 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                        {t('badge')}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                        {t('title')}
                    </h1>
                    <p className="mt-4 leading-7 text-gray-600">
                        {t('body')}
                    </p>
                    <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-sm leading-6 text-gray-600">
                        <p className="font-semibold text-gray-800">{t('noteTitle')}</p>
                        <p className="mt-2">
                            {t('noteBody')}
                        </p>
                    </div>
                    <p className="mt-6 text-xs text-gray-400">
                        {t('brand')}
                    </p>
                </div>
            </div>
        </main>
    )
}
