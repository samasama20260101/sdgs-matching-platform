'use client'

// v2.0 の画面の部品(キャンバス盤 06 の見た目)。色・角・書体は globals.css のトークンの名前だけを使う。
// 相談する側は生成りの地・丸い角、支える側と運営は白い地・小さめの角(tone で切り替える)。
import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useTranslations } from 'next-intl'

export type Tone = 'consult' | 'support'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Screen({ tone = 'consult', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-h-dvh text-ink', tone === 'consult' ? 'bg-kinari' : 'bg-steel-faint')}>
      <div className={cx('mx-auto w-full max-w-[560px] px-4 pb-28', className)}>{children}</div>
    </div>
  )
}

export function Heading({ children, level = 1, className }: { children: ReactNode; level?: 1 | 2 | 3; className?: string }) {
  const size = level === 1 ? 'text-[24px] leading-[1.5]' : level === 2 ? 'text-[18px] leading-[1.5]' : 'text-[15px] leading-[1.6]'
  const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
  return <Tag className={cx('m-0 font-heading font-bold', size, className)}>{children}</Tag>
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('m-0 text-[13.5px] leading-[1.8] text-ink-soft', className)}>{children}</p>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="block px-1 text-[12.5px] font-bold text-mist">{children}</span>
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
      className={cx('inline-flex min-h-[48px] items-center justify-center gap-2 px-4 text-[15px] font-bold transition-colors disabled:cursor-not-allowed', radius, styles[variant], className)}
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

export function Chip({ children, color = 'steel', className }: { children: ReactNode; color?: 'steel' | 'lamp' | 'dawn' | 'leaf' | 'coral' | 'night' | 'outline'; className?: string }) {
  const styles = {
    steel: 'bg-steel text-ink-soft',
    lamp: 'bg-lamp-soft text-ink',
    dawn: 'bg-dawn-soft text-dawn-ink',
    leaf: 'bg-leaf-soft text-leaf-ink',
    coral: 'bg-coral-soft text-coral',
    night: 'bg-night text-white',
    outline: 'border-[1.5px] border-dashed border-mist-light text-ink-soft',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', styles[color], className)}>{children}</span>
}

// 説明文は常に出さず、i(仕組み)と !(注意)の裏に置く(盤 46 の決まり)
export function Tip({ kind = 'info', label, children }: { kind?: 'info' | 'warn'; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-bold',
          kind === 'warn' ? 'bg-coral-soft text-coral' : 'bg-steel text-night',
        )}
      >
        {kind === 'warn' ? '!' : 'i'}
      </button>
      {open && (
        <span id={id} role="note" className="mt-2 block rounded-tool bg-kinari-deep p-3 text-[12.5px] font-normal leading-[1.75] text-ink-soft">
          {children}
        </span>
      )}
    </span>
  )
}

export function TextField({ label, hint, error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-bold">{label}{hint && <span className="ml-1 text-[11.5px] font-normal text-mist">{hint}</span>}</span>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        className="min-h-[48px] rounded-tool border-[1.5px] border-line-strong bg-paper px-3 text-[16px] text-ink outline-none focus:border-night"
      />
      {error && <span className="text-[12.5px] text-coral">{error}</span>}
    </label>
  )
}

export function TextArea({ label, error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; error?: string | null }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">{label}</span>
      <textarea
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        className="min-h-[160px] rounded-tool border-[1.5px] border-line-strong bg-paper p-3 text-[16px] leading-[1.7] text-ink outline-none focus:border-night"
      />
      {error && <span className="text-[12.5px] text-coral">{error}</span>}
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
        <span className="text-[14px] font-bold">{label}</span>
        {description && <span className="text-[12px] text-mist">{description}</span>}
      </span>
      <span className={cx('relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors', checked ? 'bg-night' : 'bg-[#BCC9D9]')}>
        <span className={cx('absolute top-[4px] h-[20px] w-[20px] rounded-full bg-white transition-all', checked ? 'left-[24px]' : 'left-[4px]')} />
      </span>
    </button>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p role="alert" className="m-0 rounded-tool bg-coral-soft px-3 py-2 text-[13px] text-coral-ink">{children}</p>
}

export function Spinner() {
  const t = useTranslations('app.common')
  return (
    <div role="status" className="flex items-center justify-center py-16 text-[13px] text-mist">
      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-night" aria-hidden />
      {t('loading')}
    </div>
  )
}
