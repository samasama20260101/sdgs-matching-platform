'use client'

// 支援団体の写真(#178)。管理の人が 1 枚載せる・変える・外す。
// 選んだ写真はこの画面で真ん中を正方形に切り抜き、512px の JPEG に描き直してから送る(撮った場所などの付帯情報は描き直しで落ちる。
// サーバーでも形を確かめて付帯情報を外す。src/lib/domain/supporterPhoto.ts)
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch, ApiError } from '@/lib/client/api'
import { Button, Card, SectionLabel, Tip } from '@/components/app/ui'
import { SupporterAvatar } from '@/components/supporters/SupporterAvatar'
import { SUPPORTER_PHOTO_MIN_SOURCE, SUPPORTER_PHOTO_SIZE, centerSquareCrop } from '@/lib/domain/supporterPhoto'

class TooSmall extends Error {}

async function toSquareJpeg(file: File): Promise<Blob> {
  // 写真の向き(スマホの縦横の情報)に合わせて読み込む
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (Math.min(bitmap.width, bitmap.height) < SUPPORTER_PHOTO_MIN_SOURCE) throw new TooSmall()
    const { sx, sy, side } = centerSquareCrop(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = SUPPORTER_PHOTO_SIZE
    canvas.height = SUPPORTER_PHOTO_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    // 透明な部分のあるロゴ(PNG)は白の上に置く
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, SUPPORTER_PHOTO_SIZE, SUPPORTER_PHOTO_SIZE)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SUPPORTER_PHOTO_SIZE, SUPPORTER_PHOTO_SIZE)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.88))
  } finally {
    bitmap.close()
  }
}

export function OrgPhotoEditor({ id, name, photoUrl, onSaved }: { id: string; name: string; photoUrl: string | null; onSaved: () => Promise<void> }) {
  const t = useTranslations('support.org')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const blob = await toSquareJpeg(file)
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      await apiFetch(`/api/support/orgs/${id}/photo`, { method: 'POST', body: form })
      await onSaved()
      setMessage(t('photoSaved'))
    } catch (e) {
      setMessage(e instanceof TooSmall ? t('photoTooSmall') : e instanceof ApiError && e.code === 'CONFLICT' ? t('photoConflict') : t('photoFailed'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const remove = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await apiFetch(`/api/support/orgs/${id}/photo`, { method: 'DELETE' })
      await onSaved()
      setMessage(t('photoRemoved'))
    } catch (e) {
      setMessage(e instanceof ApiError && e.code === 'CONFLICT' ? t('photoConflict') : t('photoFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card tone="support" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between"><SectionLabel>{t('photo')}</SectionLabel><Tip label={t('photoTipLabel')}>{t('photoTip')}</Tip></div>
      <div className="flex items-center gap-3">
        <SupporterAvatar name={name} photoUrl={photoUrl} size="lg" />
        <span className="text-t12_5 leading-[1.7] text-mist">{t('photoNote')}</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        aria-label={photoUrl ? t('photoChange') : t('photoChoose')}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
      />
      <div className="flex flex-wrap gap-2">
        <Button tone="support" variant="night" disabled={busy} onClick={() => input.current?.click()}>{photoUrl ? t('photoChange') : t('photoChoose')}</Button>
        {photoUrl && <Button tone="support" variant="outline" disabled={busy} onClick={() => void remove()}>{t('photoRemove')}</Button>}
      </div>
      {message && <span role="status" className="text-t12_5 font-bold text-ink-soft">{message}</span>}
    </Card>
  )
}
