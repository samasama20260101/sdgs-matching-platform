// 画面の枠の立場(相談する / 支える)を、開いている画面から決める(盤 04)。
// 支える側の画面(/support…)は「支える」、相談する側だけの画面は「相談する」。
// 両方で使う画面(わたし など)と入口は、前に選んだ立場のまま。
// 立場を保存の値だけで決めると、知らせのメールやブックマークから支える側の画面を直接開いたとき、相談する側のタブが出る
export type AppMode = 'consult' | 'support'

const CONSULT_ONLY = ['/home', '/talk', '/learn', '/consult', '/cases', '/handover']

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function modeForPath(pathname: string, stored: AppMode): AppMode {
  if (under(pathname, '/support')) return 'support'
  if (CONSULT_ONLY.some((p) => under(pathname, p))) return 'consult'
  return stored
}
