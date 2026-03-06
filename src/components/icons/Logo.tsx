// src/components/icons/Logo.tsx
// 明日もsamasama — 涙型ロゴ 統一コンポーネント

interface LogoProps {
  variant?: 'default' | 'white'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const cfg = {
  sm: { icon: 32, textSize: 13, subSize: 7,  gap: 10, totalW: 185 },
  md: { icon: 44, textSize: 17, subSize: 9,  gap: 12, totalW: 248 },
  lg: { icon: 64, textSize: 25, subSize: 12, gap: 16, totalW: 370 },
}

// アイコン（ダーク背景 + 涙型）単体
export function LogoIcon({ size = 36 }: { size?: number }) {
  const id = `li${size}`
  const r = Math.round(size * 0.23)
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0BC5A4"/>
          <stop offset="100%" stopColor="#0A8FD4"/>
        </linearGradient>
        <filter id={`g${id}`}><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="56" height="56" rx={r} fill="#0A1628"/>
      <path d="M28 7C28 7 11 24 11 36C11 45.4 18.6 49 28 49C37.4 49 45 45.4 45 36C45 24 28 7 28 7Z" fill={`url(#${id})`} filter={`url(#g${id})`}/>
      <circle cx="28" cy="38.5" r="7" fill="white" opacity="0.22"/>
    </svg>
  )
}

// シンボルのみ（背景なし）
export function LogoMark({ size = 36, white = false }: { size?: number; white?: boolean }) {
  const id = `lm${size}${white ? 'w' : 'd'}`
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={white ? '#5EEAD4' : '#0BC5A4'}/>
          <stop offset="100%" stopColor={white ? '#7DD3FC' : '#0A8FD4'}/>
        </linearGradient>
        <filter id={`g${id}`}><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill={`url(#${id})`} filter={`url(#g${id})`}/>
      <circle cx="28" cy="40" r="8" fill="white" opacity="0.22"/>
    </svg>
  )
}

// フルロゴ（アイコン + テキスト横組み）
export function Logo({ variant = 'default', size = 'md', showText = true, className = '' }: LogoProps) {
  const c = cfg[size]
  const isWhite = variant === 'white'
  const textColor   = isWhite ? '#F8FAFC' : '#0F172A'
  const teal        = isWhite ? '#5EEAD4' : '#0BC5A4'
  const blue        = isWhite ? '#7DD3FC' : '#0A8FD4'
  const subColor    = '#94A3B8'
  const id = `logo${size}${variant}`
  const w = showText ? c.totalW : c.icon
  const h = c.icon
  const tx = c.icon + c.gap
  const r = Math.round(c.icon * 0.23)

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`}
      width={w} height={h} fill="none" aria-label="明日もsamasama" className={className}>
      <defs>
        <linearGradient id={`${id}g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={teal}/>
          <stop offset="100%" stopColor={blue}/>
        </linearGradient>
        <filter id={`${id}f`}><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* アイコン */}
      <rect width={c.icon} height={c.icon} rx={r} fill="#0A1628"/>
      <path
        d={`M${c.icon*.5} ${c.icon*.12}C${c.icon*.5} ${c.icon*.12} ${c.icon*.2} ${c.icon*.43} ${c.icon*.2} ${c.icon*.64}C${c.icon*.2} ${c.icon*.81} ${c.icon*.33} ${c.icon*.88} ${c.icon*.5} ${c.icon*.88}C${c.icon*.67} ${c.icon*.88} ${c.icon*.8} ${c.icon*.81} ${c.icon*.8} ${c.icon*.64}C${c.icon*.8} ${c.icon*.43} ${c.icon*.5} ${c.icon*.12} ${c.icon*.5} ${c.icon*.12}Z`}
        fill={`url(#${id}g)`} filter={`url(#${id}f)`}
      />
      <circle cx={c.icon*.5} cy={c.icon*.69} r={c.icon*.13} fill="white" opacity="0.22"/>

      {showText && (
        <>
          {/* メインテキスト: 明日もsamasama */}
          <text
            x={tx} y={c.icon * 0.52}
            fontFamily="'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'Times New Roman', serif"
            fontSize={c.textSize} fontWeight="700" fill={textColor} letterSpacing="-0.3"
          >
            {'明日も'}
            <tspan fill={teal}>{'sama'}</tspan>
            <tspan fill={blue}>{'sama'}</tspan>
          </text>
          {/* サブテキスト: SDGs MATCH */}
          <text
            x={tx} y={c.icon * 0.76}
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            fontSize={c.subSize} fontWeight="300" fill={subColor} letterSpacing="3.5"
          >
            {'SDGs MATCH'}
          </text>
        </>
      )}
    </svg>
  )
}

// 後方互換
export function LogoSymbol({ size = 24 }: { size?: number }) {
  return <LogoIcon size={size}/>
}
