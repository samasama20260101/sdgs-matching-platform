'use client'

// やりとりの一覧の1行(相談する側・支える側で同じ形。画面の見直し 所見 2)。
// 題・相手・最後の一文・時刻を出し、こちらが返す番なら印を付ける
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, Chip } from '@/components/app/ui'
import { talkTurn, type LastMessage, type TalkSide } from '@/lib/domain/talk'

function shortTime(iso: string, locale: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'numeric', day: 'numeric' }).format(d)
}

export function TalkRow({ href, title, sub, last, viewer, resolved }: { href: string; title: string; sub?: string | null; last: LastMessage | null | undefined; viewer: TalkSide; resolved?: boolean }) {
  const t = useTranslations('app.talkRow')
  const locale = useLocale()
  const turn = talkTurn(last, viewer)
  const who = last ? (last.side === viewer ? t('you') : last.senderName ?? (last.side === 'CONSULTEE' ? t('consultee') : t('supporter'))) : null
  return (
    <Link href={href} className="no-underline">
      <Card className="flex flex-col gap-1 p-3.5 text-ink">
        <span className="flex items-start justify-between gap-2">
          <span className="text-t14_5 font-bold leading-[1.5]">{title}</span>
          {last && <span className="shrink-0 pt-0.5 text-t12 text-mist">{shortTime(last.at, locale)}</span>}
        </span>
        {sub && <span className="text-t12 text-mist">{sub}</span>}
        <span className={turn === 'mine' && !resolved ? 'line-clamp-2 text-t13 font-bold text-ink' : 'line-clamp-2 text-t13 text-ink-soft'}>
          {last ? `${who}: ${last.preview}` : t('noMessages')}
        </span>
        {(turn === 'mine' || resolved) && (
          <span className="flex flex-wrap gap-1 pt-0.5">
            {turn === 'mine' && !resolved && <Chip color="night">{t('yourTurn')}</Chip>}
            {resolved && <Chip color="leaf">{t('resolved')}</Chip>}
          </span>
        )}
      </Card>
    </Link>
  )
}
