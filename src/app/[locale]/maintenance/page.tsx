import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'メンテナンス中 | 明日もsamasama',
    robots: {
        index: false,
        follow: false,
    },
}

export default function MaintenancePage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 px-6 py-12">
            <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
                <div className="w-full rounded-3xl border border-blue-100 bg-white/90 p-8 shadow-sm">
                    <div className="mb-6 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                        メンテナンス中
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                        ただいまサービスを一時停止しています
                    </h1>
                    <p className="mt-4 leading-7 text-gray-600">
                        より安全にご利用いただくため、システムの更新作業を行っています。
                        作業が完了次第、通常どおりご利用いただけます。
                    </p>
                    <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-sm leading-6 text-gray-600">
                        <p className="font-semibold text-gray-800">相談中の方へ</p>
                        <p className="mt-2">
                            入力済みの相談内容やアカウント情報が、この画面によって削除されることはありません。
                            時間をおいて再度アクセスしてください。
                        </p>
                    </div>
                    <p className="mt-6 text-xs text-gray-400">
                        明日もsamasama | SDGs MATCH
                    </p>
                </div>
            </div>
        </main>
    )
}
