// 支援団体の写真か頭文字(#178)。写真は団体の管理の人が載せた正方形の JPEG。名前は隣に出すので alt は空にする
import { supporterInitial } from '@/lib/domain/emptyStates'

const SIZES = {
  sm: 'h-10 w-10 rounded-[12px] text-t16',
  md: 'h-11 w-11 rounded-[12px] text-t16',
  lg: 'h-16 w-16 rounded-[16px] text-t24',
} as const

const TONES = {
  lamp: 'bg-lamp-faint text-night',
  night: 'bg-night text-lamp',
} as const

export function SupporterAvatar({ name, photoUrl, size = 'sm', tone = 'lamp' }: { name: string; photoUrl: string | null | undefined; size?: keyof typeof SIZES; tone?: keyof typeof TONES }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- Workers では next/image の最適化を使わない。写真は 512px の正方形
    return <img src={photoUrl} alt="" loading="lazy" decoding="async" className={`${SIZES[size]} shrink-0 border border-line bg-paper object-cover`} />
  }
  return <span aria-hidden className={`${SIZES[size]} ${TONES[tone]} flex shrink-0 items-center justify-center font-bold`}>{supporterInitial(name)}</span>
}
