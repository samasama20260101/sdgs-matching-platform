import 'server-only'

// 相談の写真を縮めて WebP に描き直す。描き直すので EXIF(GPS の位置情報など)は残らない。
// Cloudflare Workers では Images binding、それ以外(Vercel・手元)では sharp を使う。
// sharp は Workers で読み込めないので、Workers の上では import しない。
import { getCloudflareContext } from '@opennextjs/cloudflare'

const MAX_EDGE = 1600
const QUALITY = 80

type ImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width?: number; height?: number; fit?: 'scale-down' | 'contain' | 'cover' }): {
      output(options: { format: 'image/webp'; quality?: number }): Promise<{ response(): Response }>
    }
  }
}

function findImagesBinding(): ImagesBinding | null {
  try {
    const env = getCloudflareContext().env as { IMAGES?: ImagesBinding }
    return env.IMAGES ?? null
  } catch {
    // Workers の外(getCloudflareContext が使えない)
    return null
  }
}

export async function reencodeToWebp(input: ArrayBuffer): Promise<Uint8Array> {
  const images = findImagesBinding()
  if (images) {
    const stream = new Blob([input]).stream()
    // Images binding は出力のメタデータを常に捨て、EXIF の向きを反映する
    const result = await images
      .input(stream)
      .transform({ width: MAX_EDGE, height: MAX_EDGE, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: QUALITY })
    return new Uint8Array(await result.response().arrayBuffer())
  }

  const { default: sharp } = await import(/* webpackIgnore: true */ 'sharp')
  const buffer = await sharp(Buffer.from(input))
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer()
  return new Uint8Array(buffer)
}
