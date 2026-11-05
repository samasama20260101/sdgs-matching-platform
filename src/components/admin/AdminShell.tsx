'use client'

// 運営の画面の枠。運営で、2つ目の確認まで済んだときだけ中身を出す(済んでいなければ /admin で確認する)。日本語だけ
import type { ReactNode } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { RequireMe } from '@/components/app/RequireMe'
import { Card, cx, Heading, Lead, Screen } from '@/components/app/ui'

// 運営の道具。countKey のあるものは、運営のホームの札に待っている件数を出す(/api/admin/counts)。
// 個人情報マスクの検証(/admin/mask-lab)は開発の道具なので、一覧には出さない
export const ADMIN_TOOLS: readonly { href: string; title: string; note: string; countKey?: 'vetting' | 'indicators' | 'inquiries' }[] = [
  { href: '/admin/vetting', title: '審査', note: '団体の申し込み・面談・承認・コーディネーター', countKey: 'vetting' },
  { href: '/admin/indicators', title: '指標の仕分け', note: '本人が選んだ指標と AI の候補を確定する', countKey: 'indicators' },
  { href: '/admin/summaries', title: '解決の要約', note: '内容・手立て・その後のナレッジ' },
  { href: '/admin/inquiries', title: 'お問い合わせ', note: '退会・付け替え・困りごとの連絡', countKey: 'inquiries' },
  { href: '/admin/stats', title: '分析', note: '今月の相談・解決の割合・待っている相談' },
  { href: '/admin/ledger', title: '指標の台帳', note: '相談の選択肢と緊急・機微の印(読むだけ)' },
  { href: '/admin/news', title: 'お知らせ', note: '書く・公開する・AI の下書き' },
]

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname()
  return (
    <RequireMe admin>
      {(me) => (
        <Screen tone="support">
          <div className="flex flex-col gap-4 py-6">
            <nav className="flex flex-wrap gap-1.5 text-[12.5px]">
              <Link href="/admin" className="font-bold text-night">運営</Link>
              {ADMIN_TOOLS.map((t) => (
                <Link key={t.href} href={t.href} className={cx('rounded-full px-2.5 py-1 no-underline', pathname.startsWith(t.href) ? 'bg-night text-white' : 'bg-paper text-ink-soft')}>{t.title}</Link>
              ))}
            </nav>
            <Heading level={2}>{title}</Heading>
            {me.mfa.verified ? children : (
              <Card tone="support" className="p-4"><Lead>2つ目の確認がまだです。<Link href="/admin" className="text-night">運営の入口</Link>で認証アプリのコードを入れてください。</Lead></Card>
            )}
          </div>
        </Screen>
      )}
    </RequireMe>
  )
}
