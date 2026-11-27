// 明日もsamasama のアイコン(#171)。線は 2px・端と角は丸く、24 の升に描く。
// 選んでいるとき(lit)だけ、決めた面に黄色の灯をともす(ロゴの「しずくと灯」と同じ灯)。黄色は紺の線の内側にだけ塗る。
// 下書きと選んだ経緯: キャンバス https://claude.ai/artifact/F8JPeSeaNw3KTGriADbVm3 の「案C 黄色の灯」(2026-11-27 岡本さん)
import type { CSSProperties } from 'react'

const circle = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

// d: 線の道筋。lit: 選んでいるときに灯の色で塗る道筋の番号
const ICONS = {
  home: { d: ['M3.6 11.6C6.5 8.6 9 6.4 10.6 5.2q1.4-1 2.8 0c1.6 1.2 4.1 3.4 7 6.4', 'M5.9 10.4v7.2q0 2.6 2.6 2.6h7q2.6 0 2.6-2.6v-7.2', circle(12, 14.6, 2.3)], lit: [2] },
  talk: { d: ['M10.2 4.3c-3.9 0-7.1 2.8-7.1 6.3 0 1.8.8 3.4 2.2 4.6l-.8 3 3.4-1.6c.7.2 1.5.3 2.3.3 3.9 0 7.1-2.8 7.1-6.3s-3.2-6.3-7.1-6.3Z', 'M19.7 10.1c.9.9 1.4 2.1 1.4 3.4 0 1.3-.5 2.5-1.4 3.5l.5 2.8-2.9-1.2c-.7.2-1.5.3-2.3.3-1.4 0-2.6-.3-3.6-.9'], lit: [0] },
  learn: { d: ['M12 7.4C10.2 5.8 7.6 5 4.5 5.1q-1.3 0-1.3 1.3v10.3q0 1.3 1.3 1.3c3.1-.1 5.7.7 7.5 2.3 1.8-1.6 4.4-2.4 7.5-2.3q1.3 0 1.3-1.3V6.4q0-1.3-1.3-1.3c-3.1-.1-5.7.7-7.5 2.3Z', 'M12 7.4v12.6'], lit: [0] },
  find: { d: [circle(10.6, 10.6, 6.6), 'M15.4 15.4l4.4 4.4'], lit: [0] },
  me: { d: [circle(12, 8.2, 4), 'M4.8 20.2c.6-3.9 3.6-6.4 7.2-6.4s6.6 2.5 7.2 6.4'], lit: [0] },
  company: { d: ['M5 20.2V6.6q0-2.2 2.2-2.2h5.6q2.2 0 2.2 2.2v13.6', 'M15 9.4h2.8q2.2 0 2.2 2.2v8.6', 'M3.4 20.2h17.2', 'M8.6 8.4h2.8M8.6 12h2.8M8.6 15.6h2.8'], lit: [] },
  community: { d: ['M2.8 13.4l4.4-3.9q.8-.7 1.6 0l4.4 3.9', 'M4.6 12.2v5.8q0 2 2 2h2.8q2 0 2-2v-5.8', 'M13 8.6l2.6-2.3q.8-.7 1.6 0l3.8 3.4', 'M19.4 8.8v9.2q0 2-2 2h-3.6'], lit: [] },
  info: { d: [circle(12, 12, 8.8), 'M12 11.2v5', 'M12 7.9h.01'], lit: [] },
  warn: { d: ['M10.4 4.9 3.5 17q-1 2 1.2 2h14.6q2.2 0 1.2-2L13.6 4.9q-1.6-2.8-3.2 0Z', 'M12 9.6v4', 'M12 16.3h.01'], lit: [] },
  phone: { d: ['M6.4 3.8h2.1q.9 0 1.2.8l1.1 3q.3.8-.4 1.4l-1.6 1.3q1.5 3.3 4.9 4.9l1.3-1.6q.6-.7 1.4-.4l3 1.1q.8.3.8 1.2v2.1q0 2-2 2C10.8 19.6 4.4 13.2 4.4 5.8q0-2 2-2Z'], lit: [] },
  external: { d: ['M13.8 4.4h5.8v5.8', 'M19.6 4.4l-8.2 8.2', 'M17.4 13.6v4q0 2-2 2H6.4q-2 0-2-2V8.6q0-2 2-2h4'], lit: [] },
  language: { d: [circle(12, 12, 8.6), 'M3.6 12h16.8', 'M12 3.4c2.3 2.4 3.5 5.3 3.5 8.6s-1.2 6.2-3.5 8.6c-2.3-2.4-3.5-5.3-3.5-8.6s1.2-6.2 3.5-8.6Z'], lit: [] },
  check: { d: ['M5.4 12.6l4.2 4.2 9-9.4'], lit: [] },
} as const satisfies Record<string, { d: readonly string[]; lit: readonly number[] }>

export type LineIconName = keyof typeof ICONS

export function LineIcon({ name, lit = false, size = 24, className, style }: { name: LineIconName; lit?: boolean; size?: number; className?: string; style?: CSSProperties }) {
  const icon = ICONS[name]
  const litParts: readonly number[] = icon.lit
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {icon.d.map((d, i) => (
        <path key={i} d={d} fill={lit && litParts.includes(i) ? 'var(--color-tomoshibi)' : 'none'} />
      ))}
    </svg>
  )
}

// 灯の点(「あなたの番」などの印)。黄色だけでは白の上で見えにくいので、紺の細い輪で囲む。意味は隣の文字が持つ
export function TomoshibiDot({ className }: { className?: string }) {
  return <span aria-hidden className={['inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-tomoshibi ring-[1.5px] ring-night', className].filter(Boolean).join(' ')} />
}
