// お知らせ記事の共有用画像(OGP)。LINE や X に記事の URL を貼ったときに、タイトル入りの大きな画像を出す。
// 記事ページ(/news/[id])の generateMetadata がこのアドレスを og:image に入れる。
// 置き場所を /api にしているのは、言語つきのアドレス(/ja/news/…)からのリダイレクトを挟まないため。
// 日本語フォントは Google Fonts から「画像に出す文字だけ」を取り寄せる(フォント全体を同梱すると数 MB になるため)。
// 記事が見つからない・フォントが取れないときは、サイト共通の画像(public/og-image.png)を返す。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { isUuid } from '@/lib/api/validation'
import { NEWS_CATEGORY_META, type NewsCategory } from '@/lib/constants/news'
import { formatNewsDate } from '@/lib/news/format'
import { getPublishedNewsById } from '@/lib/news/queries'

const SITE_NAME = '明日もsamasama'
const SITE_HOST = 'app.samasama.site'
const TITLE_MAX = 60
const SIZE = { width: 1200, height: 630 }

// 種別チップの色(公開側の chipClass と同じ系統の色)
const CHIP_COLORS: Record<NewsCategory, { bg: string; fg: string }> = {
  NOTICE:           { bg: '#f0fdfa', fg: '#0f766e' },
  MAINTENANCE:      { bg: '#fffbeb', fg: '#b45309' },
  SUPPORTER_JOINED: { bg: '#eff6ff', fg: '#1d4ed8' },
  INTERVIEW:        { bg: '#fff1f2', fg: '#be123c' },
  TOPIC:            { bg: '#f5f3ff', fg: '#6d28d9' },
}

// public/brand/logo-mark.svg と同じしずく(画像描画は filter に対応しないので外してある)
const DROP_SVG = `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0BC5A4"/><stop offset="100%" stop-color="#0A8FD4"/></linearGradient></defs><path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill="url(#g)"/><circle cx="28" cy="40" r="8" fill="white" opacity="0.22"/></svg>`
const DROP_SRC = `data:image/svg+xml;base64,${Buffer.from(DROP_SVG).toString('base64')}`

// text に含まれる文字だけのフォントを取り寄せる。Google Fonts は User-Agent を付けないと TrueType を返す(画像描画は woff2 を読めない)
async function loadFont(text: string, weight: 500 | 900): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`
  ).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`font css ${r.status}`))))
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
  if (!url) throw new Error('font url not found')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font ${res.status}`)
  return res.arrayBuffer()
}

async function fallbackImage() {
  const png = await readFile(join(process.cwd(), 'public', 'og-image.png'))
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const post = isUuid(id) ? await getPublishedNewsById(id) : null
  if (!post) return fallbackImage()

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
    return fallbackImage()
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          padding: '64px 80px', fontFamily: 'Noto Sans JP',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #f8fafc 55%, #fefce8 100%)',
        }}
      >
        {/* 右上の淡い円(サイト共通画像と同じ飾り) */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 360, height: 360, borderRadius: 9999, background: '#fef3c7', opacity: 0.6, display: 'flex' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 画像生成の中なので next/image は使えない */}
          <img src={DROP_SRC} width={48} height={48} alt="" />
          <div style={{ fontSize: 32, fontWeight: 500, color: '#0f766e', display: 'flex' }}>{SITE_NAME}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: '#94a3b8', marginLeft: 8, display: 'flex' }}>お知らせ</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: chip.fg, background: chip.bg, border: `2px solid ${chip.fg}33`, borderRadius: 9999, padding: '6px 22px', display: 'flex' }}>
              {label}
            </div>
          </div>
          <div style={{ marginTop: 28, fontSize: title.length > 30 ? 52 : 64, fontWeight: 900, color: '#0f172a', lineHeight: 1.35, display: 'flex' }}>
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: '#64748b', display: 'flex' }}>{date}</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#94a3b8', display: 'flex' }}>{SITE_HOST}</div>
        </div>
      </div>
    ),
    { ...SIZE, fonts }
  )
}
