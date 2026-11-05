// 回数の上限で使う「だれから」の鍵(純粋関数。サーバーの src/lib/server/rateLimit.ts が使う)
// Cloudflare は cf-connecting-ip、ほかは x-real-ip か x-forwarded-for の先頭。取れなければ null(呼ぶ側で 1 つの枠にまとめる)
export function clientIpFrom(headers: Headers): string | null {
  const pick = (v: string | null) => {
    const ip = v?.split(',')[0]?.trim()
    return ip && ip.length <= 64 && /^[0-9A-Fa-f:.]+$/.test(ip) ? ip : null
  }
  return pick(headers.get('cf-connecting-ip')) ?? pick(headers.get('x-real-ip')) ?? pick(headers.get('x-forwarded-for'))
}
