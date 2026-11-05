// 明日もsamasama の印(しずくと灯。キャンバス盤 10 のヘッダー)
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[9px] bg-night" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.69} height={size * 0.69} viewBox="0 0 24 24">
        <path d="M12 2.6c-.4 0-.7.2-.9.5C8.7 6.5 5.2 11.2 5.2 14.6c0 4 3 6.9 6.8 6.9s6.8-2.9 6.8-6.9c0-3.4-3.5-8.1-5.9-11.5-.2-.3-.5-.5-.9-.5Z" fill="#2BBFA4" />
        <circle cx="12" cy="15.4" r="2.9" fill="#FFD21F" />
      </svg>
    </span>
  )
}
