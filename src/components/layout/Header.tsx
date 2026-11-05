'use client'

// v1 の画面から使われていたヘッダー。v2 のヘッダー(src/components/app/AppShell.tsx)に寄せた
import { AppHeader } from '@/components/app/AppShell'

export default function Header() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4">
      <AppHeader />
    </div>
  )
}
