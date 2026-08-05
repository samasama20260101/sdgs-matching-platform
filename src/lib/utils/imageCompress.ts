// クライアント側の画像圧縮(ブラウザ専用)。
// スマホ写真は形式(HEIC等)・サイズ(10MB超)がバラバラなため、アップロード前に
// ブラウザのデコーダで読み込み→canvasで長辺1600pxのJPEGに再エンコードして統一する。
// canvas再エンコードによりEXIF(GPS位置情報等)は端末から出る前に除去される。

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

export async function compressImageToJpeg(file: File): Promise<File | null> {
  let source: ImageBitmap | HTMLImageElement | null = null
  let objectUrl: string | null = null
  try {
    // 1st: EXIFの向きを反映してデコード / 2nd: オプション未対応ブラウザ向け
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try { source = await createImageBitmap(file) } catch { /* imgフォールバックへ */ }
    }
    // 3rd: 古いブラウザ向け <img> フォールバック
    if (!source) {
      objectUrl = URL.createObjectURL(file)
      const img = new Image()
      img.src = objectUrl
      await img.decode()
      source = img
    }

    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
    if (!width || !height) return null

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return null
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } catch {
    return null
  } finally {
    if (source && source instanceof ImageBitmap) source.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
