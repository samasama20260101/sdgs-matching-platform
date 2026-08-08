// ─────────────────────────────────────────────────────────────
// 📂 src/app/sos/disaster/page.tsx
// 災害SOSフォーム（汎用）。ACTIVE_DISASTER_EVENT が null のときは閉鎖。
// 通常のヒアリング(Q1〜Q5)を通らず、3つの自由記述だけで即登録する。
// AI分析は行わない（結果ページも経由しない）。文言は sos.disaster.* で管理。
// ─────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACTIVE_DISASTER_EVENT, buildDisasterDescription, type DisasterAnswers } from '@/lib/constants/disaster';
import { CASE_PHOTO_MAX_UPLOAD_BYTES, MAX_CASE_PHOTOS } from '@/lib/constants/photos';
import { compressImageToJpeg } from '@/lib/utils/imageCompress';

const MAX_ACTIVE_CASES = 3;
const ANSWER_MAX_LENGTH = 600;
const TITLE_SNIPPET_LENGTH = 40;

type FieldKey = 'situation' | 'since' | 'wish';

const FIELDS: Array<{ key: FieldKey; qKey: 'q1' | 'q2' | 'q3'; required: boolean; examples: string[] }> = [
  { key: 'situation', qKey: 'q1', required: true, examples: ['q1Ex1', 'q1Ex2', 'q1Ex3'] },
  { key: 'since', qKey: 'q2', required: false, examples: ['q2Ex1', 'q2Ex2'] },
  { key: 'wish', qKey: 'q3', required: false, examples: ['q3Ex1', 'q3Ex2', 'q3Ex3'] },
];

export default function DisasterSosPage() {
  const t = useTranslations('sos.disaster.form');
  const tEvents = useTranslations('sos.disaster.events');
  const locale = useLocale();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<FieldKey, string>>({ situation: '', since: '', wish: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const [municipality, setMunicipality] = useState('');
  const [localArea, setLocalArea] = useState('');
  const tPhotos = useTranslations('sos.disaster.photos');
  const tLocation = useTranslations('sos.disaster.location');

  const event = ACTIVE_DISASTER_EVENT;

  // ログイン確認 + 進行中件数の上限確認（hearingと同じパターン）
  useEffect(() => {
    if (!event) { router.replace('/sos/dashboard'); return; }
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const roleRes = await fetch('/api/auth/get-role', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const roleData = await roleRes.json();
      if (!roleData.user) { router.push('/login'); return; }

      const casesRes = await fetch('/api/sos/cases', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const casesData = await casesRes.json();
      const openCases = (casesData.cases || []).filter((c: { status: string }) => c.status === 'OPEN');
      if ((openCases?.length || 0) >= MAX_ACTIVE_CASES) setLimitReached(true);
      setIsLoading(false);
    };
    checkAuth();
  }, [router, event]);

  if (!event) return null;
  const eventName = tEvents(event.i18nKey);

  const setAnswer = (key: FieldKey, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value.slice(0, ANSWER_MAX_LENGTH) }));
  };

  const addPhotos = async (fileList: FileList | null) => {
    // FileListはinputと連動する生きたオブジェクトのため、inputクリア前に同期的にコピーする
    const incoming = fileList ? Array.from(fileList) : [];
    if (incoming.length === 0) return;

    setPhotoProcessing(true);
    let nextError: string | null = null;
    const accepted: Array<{ file: File; previewUrl: string }> = [];
    let total = photoFiles.length;
    for (const file of incoming) {
      if (total >= MAX_CASE_PHOTOS) { nextError = tPhotos('tooMany'); break; }
      if (file.type && !file.type.startsWith('image/')) { nextError = tPhotos('invalidType'); continue; }
      // 端末側で長辺1600pxのJPEGに圧縮(HEIC等の形式差・10MB超・GPS情報をここで吸収)
      const compressed = await compressImageToJpeg(file);
      if (!compressed) { nextError = tPhotos('invalidType'); continue; }
      if (compressed.size > CASE_PHOTO_MAX_UPLOAD_BYTES) { nextError = tPhotos('tooLarge'); continue; }
      accepted.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
      total += 1;
    }
    setPhotoFiles((prev) => [...prev, ...accepted]);
    setPhotoError(nextError);
    setPhotoProcessing(false);
  };

  const removePhoto = (previewUrl: string) => {
    setPhotoFiles((prev) => {
      URL.revokeObjectURL(previewUrl);
      return prev.filter((p) => p.previewUrl !== previewUrl);
    });
  };

  // 例文チップ: 未入力なら差し込み、入力済みなら改行して追記
  const applyExample = (key: FieldKey, text: string) => {
    setAnswers((prev) => {
      const current = prev[key].trim();
      const next = current ? `${current}\n${text}` : text;
      return { ...prev, [key]: next.slice(0, ANSWER_MAX_LENGTH) };
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!answers.situation.trim()) {
      setErrorMessage(t('requiredError'));
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const trimmed: DisasterAnswers = {
        situation: answers.situation.trim(),
        since: answers.since.trim() || undefined,
        wish: answers.wish.trim() || undefined,
      };
      const titleSnippet = (trimmed.situation ?? '').replace(/\s+/g, ' ').slice(0, TITLE_SNIPPET_LENGTH);

      const res = await fetch('/api/sos/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: `${event.titlePrefix}${titleSnippet}`,
          description_free: buildDisasterDescription(trimmed),
          urgency: 'High',
          locale,
          intake_qna: {
            locale,
            disaster: {
              event_id: event.id,
              answers: trimmed,
              // 地域は任意入力。未選択なら送らない
              ...(municipality ? { location: { municipality, ...(localArea ? { area: localArea } : {}) } } : {}),
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { case: createdCase } = await res.json();

      // 写真アップロード(失敗しても案件登録自体は成立している)
      let anyPhotoFailed = false;
      for (const p of photoFiles) {
        const fd = new FormData();
        fd.append('file', p.file);
        const up = await fetch(`/api/sos/cases/${createdCase.id}/photos`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
          body: fd,
        }).catch(() => null);
        if (!up || !up.ok) anyPhotoFailed = true;
      }
      setPhotoUploadFailed(anyPhotoFailed);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error('[sos/disaster] submit error:', error);
      setErrorMessage(t('submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {submitted ? (
          /* ── 送信完了 ── */
          <Card className="border-rose-200">
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-gray-800 mb-3">{t('doneTitle')}</h1>
              <p className="text-sm text-gray-500 leading-relaxed mb-2">{t('doneBody')}</p>
              {/* ギャップが生まれる場所=完了画面で、返答時間の期待値と運営の約束を伝える */}
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{t('doneWaitNote')}</p>
              {photoUploadFailed && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block mb-4">
                  {tPhotos('partialFailed')}
                </p>
              )}
              <div className="mb-4" />
              <Button onClick={() => router.push('/sos/dashboard')} className="bg-rose-500 hover:bg-rose-600 text-white">
                {t('doneCta')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── 見出し ── */}
            <div className="mb-6">
              <div className="inline-block bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                🆘 {eventName}
              </div>
              <h1 className="text-2xl font-bold text-gray-800">{t('heading', { event: eventName })}</h1>
              <p className="text-gray-500 mt-2 text-sm leading-relaxed">{t('lead')}</p>
              <p className="text-xs text-gray-400 mt-2">{t('note')}</p>
              {/* 期待値の管理: サポーター供給の現状(案A)+特別措置の告知 */}
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                <p className="text-xs text-amber-800 leading-relaxed">{t('supplyNotice')}</p>
                <p className="text-xs text-amber-700/90 leading-relaxed">{t('specialNotice')}</p>
              </div>
            </div>

            {isLoading ? (
              <Card><CardContent className="py-12 text-center text-gray-400">…</CardContent></Card>
            ) : limitReached ? (
              /* ── 上限到達 ── */
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-gray-600 leading-relaxed mb-6">{t('limitNotice')}</p>
                  <Button variant="outline" onClick={() => router.push('/sos/dashboard')}>
                    {t('backToDashboard')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* ── 3問フォーム ── */
              <div className="space-y-5">
                {/* お住まいの地域(任意)。市町村→独自区分(校区等)の二段。全てスキップ可能 */}
                {(event.municipalities?.length ?? 0) > 0 && (
                  <Card className="border-l-4 border-l-rose-400">
                    <CardHeader>
                      <CardTitle className="text-base font-medium">📍 {tLocation('title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-gray-400 mb-3">{tLocation('lead')}</p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          {tLocation('municipality')}
                          <select
                            value={municipality}
                            onChange={(e) => { setMunicipality(e.target.value); setLocalArea(''); }}
                            className="rounded-lg border border-gray-200 bg-white p-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                          >
                            <option value="">{tLocation('none')}</option>
                            {(event.municipalities ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </label>
                        {event.localAreas?.[municipality] && (
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            {event.localAreas[municipality].label}
                            <select
                              value={localArea}
                              onChange={(e) => setLocalArea(e.target.value)}
                              className="rounded-lg border border-gray-200 bg-white p-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                            >
                              <option value="">{tLocation('none')}</option>
                              {event.localAreas[municipality].options.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {FIELDS.map((field, index) => (
                  <Card key={field.key} className="border-l-4 border-l-rose-400">
                    <CardHeader>
                      <CardTitle className="text-base font-medium">
                        {index + 1}. {t(field.qKey)}
                        {field.required && <span className="text-rose-500 ml-1">*</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <textarea
                        value={answers[field.key]}
                        onChange={(e) => setAnswer(field.key, e.target.value)}
                        placeholder={t(`${field.qKey}Placeholder`)}
                        rows={3}
                        maxLength={ANSWER_MAX_LENGTH}
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm leading-relaxed focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                      <p className="text-[11px] text-gray-400 mt-2 mb-1.5">{t('exampleLabel')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {field.examples.map((exampleKey) => (
                          <button
                            key={exampleKey}
                            type="button"
                            onClick={() => applyExample(field.key, t(exampleKey))}
                            className="text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full px-3 py-1.5 transition-colors text-left"
                          >
                            {t(exampleKey)}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* 写真(任意・3枚まで) */}
                <Card className="border-l-4 border-l-rose-400">
                  <CardHeader>
                    <CardTitle className="text-base font-medium">📷 {tPhotos('label')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-400 mb-3">{tPhotos('hint')}</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {photoFiles.map((p) => (
                        <div key={p.previewUrl} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.previewUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                          <button type="button" onClick={() => removePhoto(p.previewUrl)}
                            aria-label={tPhotos('remove')}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-700 text-white text-xs leading-none hover:bg-gray-900">
                            ✕
                          </button>
                        </div>
                      ))}
                      {photoFiles.length < MAX_CASE_PHOTOS && (
                        <label className={`w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-xs cursor-pointer hover:border-rose-300 hover:text-rose-500 transition-colors ${photoProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                          <span className="text-lg leading-none">{photoProcessing ? '…' : '＋'}</span>
                          <span>{tPhotos('add')}</span>
                          <input type="file" accept="image/*" multiple className="hidden"
                            onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                    {photoError && <p className="text-xs text-rose-600 mt-2">{photoError}</p>}
                  </CardContent>
                </Card>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-6 text-base"
                >
                  {isSubmitting ? t('submitting') : t('submit')}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
