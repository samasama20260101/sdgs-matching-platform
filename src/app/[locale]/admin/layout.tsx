// 運営の画面(日本語だけ)。見た目の枠は各画面の AdminShell が持つ
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: '運営 | 明日もsamasama',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return children
}
