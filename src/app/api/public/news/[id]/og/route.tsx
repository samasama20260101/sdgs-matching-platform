// お知らせ記事の共有用画像(OGP)。LINE や X に記事の URL を貼ったときに、タイトル入りの大きな画像を出す。
// 記事ページ(/news/[id])の generateMetadata がこのアドレスを og:image に入れる。
// 置き場所を /api にしているのは、言語つきのアドレス(/ja/news/…)からのリダイレクトを挟まないため。
// 日本語フォントは Google Fonts から「画像に出す文字だけ」を取り寄せる(フォント全体を同梱すると数 MB になるため)。
// 記事が見つからない・フォントが取れないときは、サイト共通の画像(public/og-image.png)へ 302 で移す。
import { ImageResponse } from 'next/og'
import { isUuid } from '@/lib/api/validation'
import { NEWS_CATEGORY_META, type NewsCategory } from '@/lib/constants/news'
import { formatNewsDate } from '@/lib/news/format'
import { getPublishedNewsById } from '@/lib/news/queries'

const SITE_NAME = '明日もsamasama'
const SITE_HOST = 'app.samasama.site'
const TITLE_MAX = 60
const SIZE = { width: 1200, height: 630 }
// 字の取り寄せを待つ上限。超えたら共通の画像にする(SNS の取りに行きが待ちきれずに失敗しないように)
const FONT_TIMEOUT_MS = 5_000

// 種別チップの色(公開側の Chip と同じ v2 のトークンの色。globals.css の @theme)
const CHIP_COLORS: Record<NewsCategory, { bg: string; fg: string }> = {
  NOTICE:           { bg: '#EAEFF6', fg: '#37414D' },
  MAINTENANCE:      { bg: '#FFEEB9', fg: '#14283F' },
  SUPPORTER_JOINED: { bg: '#E6F5D2', fg: '#334800' },
  INTERVIEW:        { bg: '#DDF2FE', fg: '#07465F' },
  TOPIC:            { bg: '#FFFFFF', fg: '#37414D' },
}

// 画面のヘッダーと同じ印(しずくと灯。src/components/app/Mark.tsx)
const DROP_SVG = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="18" fill="#173A5E"/><g transform="translate(10 10) scale(1.84)"><path d="M12 2.6c-.4 0-.7.2-.9.5C8.7 6.5 5.2 11.2 5.2 14.6c0 4 3 6.9 6.8 6.9s6.8-2.9 6.8-6.9c0-3.4-3.5-8.1-5.9-11.5-.2-.3-.5-.5-.9-.5Z" fill="#2BBFA4"/><circle cx="12" cy="15.4" r="2.9" fill="#FFD21F"/></g></svg>`
const DROP_SRC = `data:image/svg+xml;base64,${Buffer.from(DROP_SVG).toString('base64')}`

// text に含まれる文字だけのフォントを取り寄せる。Google Fonts は User-Agent を付けないと TrueType を返す(画像描画は woff2 を読めない)
async function loadFont(text: string, weight: 500 | 900): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`,
    { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) },
  ).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`font css ${r.status}`))))
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
  if (!url) throw new Error('font url not found')
  const res = await fetch(url, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`font ${res.status}`)
  return res.arrayBuffer()
}

// 記事がない・字を取れないときは、サイト共通の画像へ移す(静的な配信に任せる。Workers ではファイルを読めない)。
// 記事があとで公開されたり、字の取り寄せが直ったりするので、短くだけ覚えさせる
function fallbackImage(request: Request) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL('/og-image.png', request.url).toString(), 'Cache-Control': 'public, max-age=300' },
  })
}

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const post = isUuid(id) ? await getPublishedNewsById(id) : null
  if (!post) return fallbackImage(request)

  const title = post.title.length > TITLE_MAX ? `${post.title.slice(0, TITLE_MAX)}…` : post.title
  const label = NEWS_CATEGORY_META[post.category].labelJa
  const chip = CHIP_COLORS[post.category]
  const date = formatNewsDate(post.published_at, 'ja')

  let fonts: { name: string; data: ArrayBuffer; weight: 500 | 900; style: 'normal' }[]
  try {
    const [regular, black] = await Promise.all([
      loadFont(`${SITE_NAME}${SITE_HOST}お知らせ${label}${date}`, 500),
      loadFont(title, 900),
    ])
    fonts = [
      { name: 'Noto Sans JP', data: regular, weight: 500, style: 'normal' },
      { name: 'Noto Sans JP', data: black, weight: 900, style: 'normal' },
    ]
  } catch (error) {
    console.error('[news] og font error:', error)
    return fallbackImage(request)
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          padding: '64px 80px', fontFamily: 'Noto Sans JP',
          background: '#FAF6EC',
        }}
      >
        {/* 右上の淡い円(灯の色) */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 360, height: 360, borderRadius: 9999, background: '#FFF7DE', display: 'flex' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 画像生成の中なので next/image は使えない */}
          <img src={DROP_SRC} width={48} height={48} alt="" />
          <div style={{ fontSize: 32, fontWeight: 500, color: '#173A5E', display: 'flex' }}>{SITE_NAME}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#505C6C', marginLeft: 8, display: 'flex' }}>お知らせ</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: chip.fg, background: chip.bg, border: '2px solid #CFC5AE', borderRadius: 9999, padding: '6px 22px', display: 'flex' }}>
              {label}
            </div>
          </div>
          <div style={{ marginTop: 28, fontSize: title.length > 30 ? 52 : 64, fontWeight: 900, color: '#14283F', lineHeight: 1.35, display: 'flex' }}>
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #E8E0CC', paddingTop: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: '#505C6C', display: 'flex' }}>{date}</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#505C6C', display: 'flex' }}>{SITE_HOST}</div>
        </div>
      </div>
    ),
    // URL に記事の更新時刻(?v=)が入るので、同じ URL の画像は変わらない。描き直しを減らすため長く覚えさせる
    { ...SIZE, fonts, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } }
  )
}
