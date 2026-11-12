// 長い文の公開ページ(お知らせ・ストーリー・利用規約・プライバシーポリシー)の枠と、本文の部品。
// v2 のヘッダーとフッターで挟み、見出しと本文の文字はトークンの色と書体だけを使う。サーバーでもブラウザでも使える
import type { ReactNode } from 'react'
import { AppHeader } from '@/components/app/AppShell'
import { Footer } from '@/components/app/Footer'
import { Heading, Screen } from '@/components/app/ui'
import { JaOnlyNotice } from '@/components/i18n/JaOnlyNotice'

// jaOnly: 本文が日本語だけのページ。日本語以外で開いたときに、そう伝える
export function DocShell({ children, jaOnly = false }: { children: ReactNode; jaOnly?: boolean }) {
  return (
    <Screen>
      <AppHeader />
      <main className="flex flex-col gap-5 pb-6 pt-2">
        {jaOnly && <JaOnlyNotice />}
        {children}
      </main>
      <Footer />
    </Screen>
  )
}

// ページの題と、その下の小さな添え書き(更新日・説明)
export function DocTitle({ title, note }: { title: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-1">
      <Heading>{title}</Heading>
      {note && <span className="text-t12_5 text-mist">{note}</span>}
    </div>
  )
}

// 規約などの本文。箇条書きには点を付け、入れ子の箇条書きは少し下げる
const PROSE = [
  'flex flex-col gap-3 text-t14 leading-[1.9] text-ink-soft',
  '[&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:marker:text-mist-light',
  '[&_ol]:m-0 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-5',
  '[&_li_ul]:mt-1.5 [&_p]:m-0 [&_strong]:font-bold [&_strong]:text-ink',
  '[&_a]:text-night [&_a]:underline [&_a]:underline-offset-2',
].join(' ')

export function DocSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <Heading level={2} className="text-t16">{title}</Heading>
      <div className={PROSE}>{children}</div>
    </section>
  )
}

export function DocSubSection({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-t14 font-bold text-ink">{label}</span>
      <div className="pl-3">{children}</div>
    </div>
  )
}

// 本文と同じ見た目の段落(節の外で使う前書きなど)
export function DocProse({ children }: { children: ReactNode }) {
  return <div className={PROSE}>{children}</div>
}
