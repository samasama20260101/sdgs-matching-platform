// src/components/icons/Logo.tsx
// 明日もsamasama - DropletMatchロゴコンポーネント

interface LogoProps {
  variant?: 'default' | 'white'  // default=ダーク文字, white=白文字
  size?: 'sm' | 'md' | 'lg'     // sm=ヘッダー用, md=ログイン画面, lg=トップhero
  showText?: boolean              // シンボルのみの場合はfalse
}

const sizes = {
  sm: { symbol: 28, text: 13, sub: 7 },
  md: { symbol: 40, text: 18, sub: 9 },
  lg: { symbol: 64, text: 28, sub: 12 },
}

// 日本語文字込みの横幅係数（「明日もsamasama」が収まる余裕を持たせる）
const widthMultiplier = {
  sm: 5.0,
  md: 4.8,
  lg: 4.6,
}

export function Logo({ variant = 'default', size = 'md', showText = true }: LogoProps) {
  const s = sizes[size]
  const textColor = variant === 'white' ? '#ffffff' : '#0F172A'
  const subColor = '#94A3B8'
  const d1Start = variant === 'white' ? '#7DD3FC' : '#0EA5E9'
  const d1End   = variant === 'white' ? '#6EE7B7' : '#10B981'

  const w = showText ? s.symbol * widthMultiplier[size] : s.symbol
  const h = s.symbol

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      fill="none"
      aria-label="明日もsamasama"
    >
      <defs>
        <linearGradient id={`dl1-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={d1Start}/>
          <stop offset="100%" stopColor={d1End}/>
        </linearGradient>
        <linearGradient id={`dl2-${size}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={d1End}/>
          <stop offset="100%" stopColor={d1Start}/>
        </linearGradient>
        <filter id={`glow-${size}`}>
          <feGaussianBlur stdDeviation="0.8" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* シンボル：2つの雫 */}
      {/* 左の雫（SOS側・上向き） */}
      <path
        d={`M${s.symbol*0.34} ${s.symbol*0.72}
           C${s.symbol*0.34} ${s.symbol*0.72}
            ${s.symbol*0.18} ${s.symbol*0.52}
            ${s.symbol*0.18} ${s.symbol*0.38}
           C${s.symbol*0.18} ${s.symbol*0.22}
            ${s.symbol*0.27} ${s.symbol*0.12}
            ${s.symbol*0.34} ${s.symbol*0.12}
           C${s.symbol*0.41} ${s.symbol*0.12}
            ${s.symbol*0.50} ${s.symbol*0.22}
            ${s.symbol*0.50} ${s.symbol*0.38}
           C${s.symbol*0.50} ${s.symbol*0.52}
            ${s.symbol*0.34} ${s.symbol*0.72}
            ${s.symbol*0.34} ${s.symbol*0.72}Z`}
        fill={`url(#dl1-${size})`}
        opacity="0.95"
        filter={`url(#glow-${size})`}
      />
      {/* 右の雫（サポーター側・下向き） */}
      <path
        d={`M${s.symbol*0.56} ${s.symbol*0.28}
           C${s.symbol*0.56} ${s.symbol*0.28}
            ${s.symbol*0.72} ${s.symbol*0.48}
            ${s.symbol*0.72} ${s.symbol*0.62}
           C${s.symbol*0.72} ${s.symbol*0.78}
            ${s.symbol*0.63} ${s.symbol*0.88}
            ${s.symbol*0.56} ${s.symbol*0.88}
           C${s.symbol*0.49} ${s.symbol*0.88}
            ${s.symbol*0.40} ${s.symbol*0.78}
            ${s.symbol*0.40} ${s.symbol*0.62}
           C${s.symbol*0.40} ${s.symbol*0.48}
            ${s.symbol*0.56} ${s.symbol*0.28}
            ${s.symbol*0.56} ${s.symbol*0.28}Z`}
        fill={`url(#dl2-${size})`}
        opacity="0.72"
      />
      {/* 交点の光 */}
      <circle
        cx={s.symbol * 0.45}
        cy={s.symbol * 0.50}
        r={s.symbol * 0.055}
        fill="white"
        opacity="0.92"
        filter={`url(#glow-${size})`}
      />

      {/* テキスト */}
      {showText && (
        <>
          <text
            x={s.symbol * 0.95}
            y={s.symbol * 0.46}
            fontFamily="'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif"
            fontSize={s.text}
            fontWeight="800"
            fill={textColor}
            letterSpacing="-0.3"
          >
            明日も
            <tspan fill={`url(#dl1-${size})`}>sama</tspan>
            <tspan fill={`url(#dl2-${size})`}>sama</tspan>
          </text>
          <text
            x={s.symbol * 0.95}
            y={s.symbol * 0.72}
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            fontSize={s.sub}
            fontWeight="300"
            fill={subColor}
            letterSpacing="3"
          >
            SDGs MATCH
          </text>
        </>
      )}
    </svg>
  )
}

// シンボルのみ（ファビコン代替・小さいスペース用）
export function LogoSymbol({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} fill="none">
      <defs>
        <linearGradient id="ls1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0EA5E9"/>
          <stop offset="100%" stopColor="#10B981"/>
        </linearGradient>
        <linearGradient id="ls2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10B981"/>
          <stop offset="100%" stopColor="#0EA5E9"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0F172A"/>
      <path d="M28 44C28 44 14 30 14 22C14 13.2 20.3 8 28 8C35.7 8 42 13.2 42 22C42 30 28 44 28 44Z" fill="url(#ls1)" opacity="0.95"/>
      <path d="M36 20C36 20 50 34 50 42C50 50.8 43.7 56 36 56C28.3 56 22 50.8 22 42C22 34 36 20 36 20Z" fill="url(#ls2)" opacity="0.75"/>
      <circle cx="32" cy="32" r="4" fill="white" opacity="0.9"/>
    </svg>
  )
}
