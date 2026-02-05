import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'SDGsマッチングプラットフォーム',
    description: 'SDGsに関する相談とNPOをマッチングするプラットフォーム',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <body>{children}</body>
        </html>
    )
}