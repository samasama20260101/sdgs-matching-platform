// 立ちポーズのナミア(namia.webp)。体は動かさず、おなかの光ときらきらだけを動かす(コーポレートサイトの NamiaGlow と同じ絵と動き)。
// 座標は namia.webp の中の光る位置に合わせた %。動きを減らす設定の人には止めて見せる(globals.css の .namia-*)
const SPARKS: { left: number; top: number; width: number; delay: number; duration: number }[] = [
  // 右手元のきらきら
  { left: 63, top: 77, width: 8, delay: 0.2, duration: 1.8 },
  { left: 69, top: 71, width: 5, delay: 0.7, duration: 1.6 },
  { left: 72, top: 79, width: 6, delay: 1.0, duration: 2.0 },
  { left: 76, top: 80, width: 4, delay: 0.4, duration: 1.7 },
  // 左手まわりの泡
  { left: 7, top: 45, width: 6, delay: 0.9, duration: 2.1 },
  { left: 13, top: 50, width: 5, delay: 0.1, duration: 1.8 },
  { left: 8, top: 53, width: 4, delay: 1.3, duration: 1.6 },
]

export function NamiaGlow({ size, alt }: { size: number; alt: string }) {
  return (
    <span className="namia" style={{ width: `${size}px` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Workers では next/image の最適化を使わない */}
      <img src="/namia.webp" alt={alt} width={size} height={Math.round((size * 1223) / 910)} className="block h-auto w-full" />
      <span className="namia-glow" style={{ left: '52%', top: '73%', width: '46%' }} />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="namia-spark"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.width}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
        />
      ))}
    </span>
  )
}
