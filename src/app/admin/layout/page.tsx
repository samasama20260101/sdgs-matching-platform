// src/app/admin/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: '管理画面 | SDGsマッチング',
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-100">
            {children}
        </div>
    )
}