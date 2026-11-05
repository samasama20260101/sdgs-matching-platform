// 知らせのメールの文面(純粋関数)。相談の中身・相手の名前・団体の名前を入れない。件名は言語ごとに1つだけ
import type { NoticeKind } from './notifyUser'

const SUBJECT: Record<string, string> = {
  ja: '明日もsamasama からのお知らせ',
  en: 'A notice from samasama',
  es: 'Un aviso de samasama',
}

const BODY: Record<string, string> = {
  ja: '新しいお知らせがあります。アプリを開いて確かめてください。',
  en: 'You have a new notice. Please open the app to check it.',
  es: 'Tienes un aviso nuevo. Abre la app para verlo.',
}

const FOOTER: Record<string, string> = {
  ja: 'このメールを止めるときは、アプリの「わたし」→「お知らせの受け取り方」でメールをオフにしてください。',
  en: 'To stop these emails, turn off email in Me → Notifications in the app.',
  es: 'Para dejar de recibir estos correos, desactiva el correo en Yo → Avisos dentro de la app.',
}

export function buildNoticeEmail(locale: string, kind: NoticeKind, origin: string): { subject: string; text: string } {
  const l = locale in SUBJECT ? locale : 'ja'
  // 種類によって変えるのは開く先だけ(中身が分かる言葉を入れない)
  const path = kind === 'NEW_OFFER' || kind === 'RESOLVE_REPORTED' ? '/home' : kind === 'NEW_MESSAGE' ? '/talk' : '/support'
  const prefix = l === 'ja' ? '' : `/${l}`
  return { subject: SUBJECT[l], text: `${BODY[l]}\n\n${origin}${prefix}${path}\n\n${FOOTER[l]}\n` }
}
