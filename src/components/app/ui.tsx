'use client'

// v2.0 の画面の部品(キャンバス盤 06 の見た目)。色・角・書体は globals.css のトークンの名前だけを使う。
// 相談する側は生成りの地・丸い角、支える側と運営は白い地・小さめの角(tone で切り替える)。
import { useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { LineIcon } from './LineIcon'

export type Tone = 'consult' | 'support'

// 選んだもの = 灯がともる(#171、2026-11-27 岡本さん)。どの画面の選ぶものも、この 4 つのどれかで書く。
// 小さな札(ありがとうの言葉・地域・種類・顔の切り替え)は灯の黄色で塗り、大きな選択肢は淡い灯の面に紺の枠。
// 紺で塗る見た目は「相談する / 支える」の切り替えとタブの段だけに残す(選んだものではなく、いる場所なので)
export const chipOn = 'border border-night bg-tomoshibi text-ink'
export const chipOff = 'border border-line bg-paper text-ink-soft'
export const choiceOn = 'border-2 border-night bg-tomoshibi-soft text-ink'
export const choiceOff = 'border-[1.5px] border-line-strong bg-paper text-ink-soft'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// wide: 2 列で使う運営の編集画面(お知らせ)だけ。ほかの画面はスマホの幅に合わせた 560px
export function Screen({ tone = 'consult', wide = false, children, className }: { tone?: Tone; wide?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-h-dvh text-ink', tone === 'consult' ? 'bg-kinari' : 'bg-steel-faint')}>
      <div className={cx('mx-auto w-full px-4 pb-28', wide ? 'max-w-6xl' : 'max-w-[560px]', className)}>{children}</div>
    </div>
  )
}

// 何段目かの帯(相談を書く・はじめる・体験)。読み上げには文字で伝え、帯は飾り
export function StepBar({ label, step, total }: { label?: string; step: number; total: number }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-t12 font-bold text-mist">{label}</span>}
      <Lamps count={total} lit={step} />
    </div>
  )
}

// 進み具合の灯。済んだ段といまの段に灯がともり、間を紺の線でつなぐ(#171)。labels を渡すと灯の下に名前を出す
export function Lamps({ count, lit, labels, current, label }: { count: number; lit: number; labels?: string[]; current?: number; label?: string }) {
  return (
    <ol className="m-0 flex list-none p-0" aria-label={label} aria-hidden={labels ? undefined : true}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-1 flex-col items-center gap-1" aria-current={current === i ? 'step' : undefined}>
          <span className="flex w-full items-center" aria-hidden>
            <span className={cx('h-0.5 flex-1', i === 0 ? 'bg-transparent' : i < lit ? 'bg-night' : 'bg-line')} />
            <span className={cx('h-3.5 w-3.5 shrink-0 rounded-full border-2', i < lit ? 'border-night bg-tomoshibi' : 'border-line-strong bg-paper')} />
            <span className={cx('h-0.5 flex-1', i === count - 1 ? 'bg-transparent' : i < lit - 1 ? 'bg-night' : 'bg-line')} />
          </span>
          {labels && <span className={cx('text-t11', current === i ? 'font-bold text-ink' : 'text-mist')}>{labels[i]}</span>}
        </li>
      ))}
    </ol>
  )
}

export function Heading({ children, level = 1, className }: { children: ReactNode; level?: 1 | 2 | 3; className?: string }) {
  const size = level === 1 ? 'text-t24 leading-[1.5]' : level === 2 ? 'text-t18 leading-[1.5]' : 'text-t15 leading-[1.6]'
  const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
  return <Tag className={cx('m-0 font-heading font-bold', size, className)}>{children}</Tag>
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('m-0 text-t13_5 leading-[1.8] text-ink-soft', className)}>{children}</p>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="block px-1 text-t12_5 font-bold text-mist">{children}</span>
}

type ButtonVariant = 'night' | 'lamp' | 'outline' | 'quiet' | 'danger'

export function Button({
  variant = 'night',
  tone = 'consult',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; tone?: Tone }) {
  const radius = tone === 'consult' ? 'rounded-[16px]' : 'rounded-tool'
  const styles: Record<ButtonVariant, string> = {
    night: 'bg-night text-white hover:bg-night-deep disabled:bg-[#D6DFEB] disabled:text-mist',
    lamp: 'bg-lamp text-ink hover:brightness-95 disabled:bg-line disabled:text-mist',
    outline: 'border-[1.5px] border-line-strong bg-paper text-ink hover:bg-kinari-deep disabled:text-mist',
    quiet: 'bg-transparent text-night underline-offset-4 hover:underline disabled:text-mist',
    danger: 'border-[1.5px] border-coral text-coral bg-paper hover:bg-coral-soft disabled:opacity-60',
  }
  return (
    <button
      type="button"
      {...rest}
      className={cx('inline-flex min-h-[48px] items-center justify-center gap-2 px-4 text-t15 font-bold btn-track transition-colors disabled:cursor-not-allowed', radius, styles[variant], className)}
    >
      {children}
    </button>
  )
}

export function Card({ tone = 'consult', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <div className={cx('border border-line bg-paper', tone === 'consult' ? 'rounded-soft' : 'rounded-tool', className)}>
      {children}
    </div>
  )
}

export function Chip({ children, color = 'steel', className }: { children: ReactNode; color?: 'steel' | 'lamp' | 'tomoshibi' | 'dawn' | 'leaf' | 'coral' | 'night' | 'outline'; className?: string }) {
  const styles = {
    steel: 'bg-steel text-ink-soft',
    // あなたの番(返事が来ている)の札。灯の黄色に墨の文字(#171)
    tomoshibi: 'bg-tomoshibi text-ink',
    lamp: 'bg-lamp-soft text-ink',
    dawn: 'bg-dawn-soft text-dawn-ink',
    leaf: 'bg-leaf-soft text-leaf-ink',
    coral: 'bg-coral-soft text-coral',
    night: 'bg-night text-white',
    outline: 'border-[1.5px] border-dashed border-mist-light text-ink-soft',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-t11_5 font-bold', styles[color], className)}>{children}</span>
}

// 説明文は常に出さず、i(仕組み)と !(注意)の裏に置く(盤 46 の決まり)。
// 押すと(マウスなら乗せても)吹き出しで重ねて出す。画面の流れに差し込まないので、隣の見出しや並びを押し広げない(2026-11-06 岡本さん)。
// 吹き出しは body に出し、ボタンの下(入らなければ上)に置く。ボタンが画面の右半分なら吹き出しの右端を、左半分なら左端をボタンにそろえる
// (見出しの横の i が多いので、本文の段からはみ出さない)。画面の端から 16px は離す。外を押す・Esc で閉じる
const TIP_GAP = 10
const TIP_EDGE = 16
// 吹き出しの端を、ボタンの端より少し外に出す(矢印が角の丸みにかからないように)
const TIP_ALIGN = 8

export function Tip({ kind = 'info', label, children }: { kind?: 'info' | 'warn'; label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const open = pinned || hovered
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const button = buttonRef.current
    const bubble = bubbleRef.current
    if (!open || !button || !bubble) return
    const place = () => {
      const r = button.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const w = bubble.offsetWidth
      const h = bubble.offsetHeight
      const center = r.left + r.width / 2
      const aligned = center > width / 2 ? r.right + TIP_ALIGN - w : r.left - TIP_ALIGN
      const left = Math.min(Math.max(aligned, TIP_EDGE), width - TIP_EDGE - w)
      const below = r.bottom + TIP_GAP + h <= window.innerHeight - TIP_EDGE || r.top - TIP_GAP - h < TIP_EDGE
      bubble.style.left = `${left}px`
      bubble.style.top = `${below ? r.bottom + TIP_GAP : r.top - TIP_GAP - h}px`
      bubble.style.setProperty('--tip-arrow', `${center - left}px`)
      bubble.dataset.side = below ? 'bottom' : 'top'
    }
    place()
    const outside = (e: PointerEvent) => {
      if (!button.contains(e.target as Node) && !bubble.contains(e.target as Node)) {
        setPinned(false)
        setHovered(false)
      }
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPinned(false)
      setHovered(false)
      button.focus()
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        aria-label={label}
        onClick={() => setPinned((v) => !v)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
        className={cx(
          // 見た目は 22px の丸、押せる範囲は 44px
          "relative inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full before:absolute before:-inset-[11px] before:content-['']",
          kind === 'warn' ? 'text-coral' : 'text-night',
        )}
      >
        <LineIcon name={kind === 'warn' ? 'warn' : 'info'} size={22} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="group fixed left-0 top-0 z-50 block w-max max-w-[min(280px,calc(100vw-32px))] rounded-[10px] bg-night px-3.5 py-2.5 text-left text-t12_5 font-normal leading-[1.7] text-white shadow-[0_8px_24px_rgba(15,39,65,0.22)]"
        >
          <span aria-hidden className="absolute left-[calc(var(--tip-arrow)-5px)] -top-[5px] h-2.5 w-2.5 rotate-45 rounded-[2px] bg-night group-data-[side=top]:-bottom-[5px] group-data-[side=top]:top-auto" />
          <span className="relative block">{children}</span>
        </span>,
        document.body,
      )}
    </>
  )
}

export function TextField({ label, hint, error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-t13 font-bold">{label}{hint && <span className="ml-1 text-t11_5 font-normal text-mist">{hint}</span>}</span>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-t16 text-ink outline-none focus:border-night"
      />
      {error && <span className="text-t12_5 text-coral">{error}</span>}
    </label>
  )
}

// compact: 一言そえる欄のように、短く書く前提の欄(低めにする)
export function TextArea({ label, error, compact = false, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; error?: string | null; compact?: boolean }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-t13 font-bold">{label}</span>
      <textarea
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={cx(compact ? 'min-h-[88px]' : 'min-h-[160px]', 'rounded-tool border-[1.5px] border-line-strong bg-paper p-3 text-t16 leading-[1.7] text-ink outline-none focus:border-night')}
      />
      {error && <span className="text-t12_5 text-coral">{error}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 text-left disabled:opacity-60"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-t14 font-bold">{label}</span>
        {description && <span className="text-t12 text-mist">{description}</span>}
      </span>
      {/* オンにすると、つまみに灯がともる(#171) */}
      <span className={cx('relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors', checked ? 'bg-night' : 'bg-[#BCC9D9]')}>
        <span className={cx('absolute top-[4px] h-[20px] w-[20px] rounded-full transition-all', checked ? 'left-[24px] bg-tomoshibi' : 'left-[4px] bg-white')} />
      </span>
    </button>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p role="alert" className="m-0 rounded-tool bg-coral-soft px-3 py-2 text-t13 text-coral-ink">{children}</p>
}

export function Spinner() {
  const t = useTranslations('app.common')
  return (
    <div role="status" className="flex items-center justify-center py-16 text-t13 text-mist">
      {/* ロゴのしずくの中で、灯がゆっくり明るくなる(#171) */}
      <svg viewBox="0 0 24 24" width="20" height="20" className="mr-2 shrink-0" aria-hidden="true" focusable="false">
        <path d="M12 2.6c-.4 0-.7.2-.9.5C8.7 6.5 5.2 11.2 5.2 14.6c0 4 3 6.9 6.8 6.9s6.8-2.9 6.8-6.9c0-3.4-3.5-8.1-5.9-11.5-.2-.3-.5-.5-.9-.5Z" fill="none" stroke="var(--color-night)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="12" cy="15.4" r="2.9" fill="var(--color-tomoshibi)" className="tomoshibi-pulse" />
      </svg>
      {t('loading')}
    </div>
  )
}
