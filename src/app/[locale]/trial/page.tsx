// ─────────────────────────────────────────────────────────────
// 📂 src/app/[locale]/trial/page.tsx
// 相談フォームの体験ページ(ログイン不要・公開)。
//
// - 本番と同じ入力欄(IntakeFormFields)に答えてもらい、結果として
//   「AI に渡す直前の個人情報マスク(src/lib/pii.ts の層1)」を原文と並べて見せる。
// - すべてブラウザ内で完結する。API 呼び出し・DB 保存・AI 分析は一切しない
//   (費用が発生しない・入力が端末の外に出ない、がこのページの約束)。
//   ここに fetch や supabase の呼び出しを足さないこと。
// ─────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import IntakeFormFields, { CHAR_LIMITS, QA_QUESTIONS, toggleIntakeOption, type IntakeFreeText, type IntakeSelections, type QAOption, type QAQuestion } from '@/components/sos/IntakeFormFields';
import { SUPPORTER_RECRUIT_URL } from '@/lib/constants/links';
import { SDG_COLORS } from '@/lib/constants/sdgs';
import { PII_PLACEHOLDERS, detectPiiSpans, type PiiCategory, type PiiSpan } from '@/lib/pii';

const CATEGORY_CLASSES: Record<PiiCategory, string> = {
  phone: 'bg-red-100 text-red-800 border-red-300',
  email: 'bg-orange-100 text-orange-800 border-orange-300',
  postal: 'bg-amber-100 text-amber-800 border-amber-300',
  address: 'bg-lime-100 text-lime-800 border-lime-300',
  url: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  sns: 'bg-sky-100 text-sky-800 border-sky-300',
  dob: 'bg-violet-100 text-violet-800 border-violet-300',
  date: 'bg-purple-100 text-purple-800 border-purple-300',
  number: 'bg-gray-200 text-gray-700 border-gray-400',
};

// 「本番ではこのあと」の表示例で見せる支援分野(住まい・お金)
const MOCK_GOALS = [11, 1];

// 例文で選んでおく選択肢(Q1 は住まい、ほかは「該当なし」)
const SAMPLE_OPTION_IDS: Record<number, string[]> = {
  1: ['q1_2'], 2: ['q2_5'], 3: ['q3_5'], 4: ['q4_5'], 5: ['q5_6'],
};

// 原文(色付き)またはマスク後(印に置き換え)を描く
function SpanText({ text, spans, masked }: { text: string; spans: PiiSpan[]; masked: boolean }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, s.start)}</span>);
    parts.push(
      <mark key={`m${i}`} className={`rounded border px-1 mx-0.5 font-medium ${CATEGORY_CLASSES[s.cat]}`}>
        {masked ? PII_PLACEHOLDERS[s.cat] : text.slice(s.start, s.end)}
      </mark>
    );
    cursor = s.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <p className="text-sm leading-loose whitespace-pre-wrap break-words text-gray-700">{parts}</p>;
}

// 「本番ではこのあと」の 1 段。右側に画面の表示例(架空の内容)を置く
function NextStep({ number, title, description, exampleTag, last, children }: {
  number: number; title: string; description: string; exampleTag: string; last?: boolean; children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">{number}</span>
        {!last && <span className="mt-1 w-0.5 flex-1 bg-teal-200" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className="pt-1 text-sm font-bold text-gray-800">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">{description}</p>
        <div className="relative mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="absolute -top-2 right-3 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500">{exampleTag}</span>
          {children}
        </div>
      </div>
    </li>
  );
}

export default function TrialPage() {
  const t = useTranslations('sos.trial');
  const tHearing = useTranslations('sos.hearing');
  const tQ = useTranslations('sos.questions');
  const tWord = useTranslations('sdgs.wordLabel');

  const [selectedOptionIds, setSelectedOptionIds] = useState<IntakeSelections>({});
  const [freeText, setFreeText] = useState<IntakeFreeText>({ what: '', when: '', want: '' });
  const [error, setError] = useState<string | null>(null);
  // 「体験する」を押した時点の、AI に渡すはずの文(入力欄を直しても結果がずれないように固定する)
  const [resultText, setResultText] = useState<string | null>(null);

  const handleToggleOption = (question: QAQuestion, option: QAOption) => {
    setSelectedOptionIds(prev => toggleIntakeOption(prev, question, option));
  };

  const handleFillSample = () => {
    setSelectedOptionIds(Object.fromEntries(
      Object.entries(SAMPLE_OPTION_IDS).map(([questionId, ids]) => [Number(questionId), new Set(ids)])
    ));
    setFreeText({ what: t('sample.what'), when: t('sample.when'), want: t('sample.want') });
    setError(null);
  };

  // 本番(gemini/analyze の buildDescriptionFromCase)と同じ並び: 選択した回答 → 自由記述。
  // 「該当なし」だけの設問は載せない
  const buildTextForAi = () => {
    const qaLines = QA_QUESTIONS.map((q) => {
      const answers = q.options
        .filter((option) => !option.exclusive && selectedOptionIds[q.id]?.has(option.id))
        .map((option) => tQ(`q${q.id}.options.${option.id}`));
      return answers.length > 0 ? `Q${q.id}: ${answers.join('、')}` : '';
    }).filter(Boolean).join('\n');
    const description = [
      freeText.what.trim(),
      freeText.when.trim() ? `${tHearing('whenPrefix')}${freeText.when.trim()}` : '',
      freeText.want.trim() ? `${tHearing('wantPrefix')}${freeText.want.trim()}` : '',
    ].filter(Boolean).join('\n');
    return [qaLines, description].filter(Boolean).join('\n\n');
  };

  const handleSubmit = () => {
    setError(null);
    // バリデーションは本番のフォームと同じ
    for (const q of QA_QUESTIONS) {
      if ((selectedOptionIds[q.id]?.size || 0) === 0) {
        setError(tHearing('errorAnswerRequired', { id: q.id }));
        return;
      }
    }
    if (!freeText.what.trim()) {
      setError(tHearing('errorWhatRequired'));
      return;
    }
    if (freeText.what.length > CHAR_LIMITS.what) {
      setError(tHearing('errorWhatTooLong', { max: CHAR_LIMITS.what }));
      return;
    }
    setResultText(buildTextForAi());
    window.scrollTo({ top: 0 });
  };

  const handleRetry = () => {
    setResultText(null);
    window.scrollTo({ top: 0 });
  };

  const spans = resultText ? detectPiiSpans(resultText) : [];
  const counts = new Map<PiiCategory, number>();
  spans.forEach((s) => counts.set(s.cat, (counts.get(s.cat) || 0) + 1));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <span className="inline-block rounded-full bg-teal-600 px-3 py-0.5 text-xs font-bold text-white">{t('badge')}</span>
          <h1 className="mt-2 text-2xl font-bold text-gray-800">{resultText === null ? t('title') : t('resultTitle')}</h1>
          {resultText === null && <p className="text-gray-500 mt-1">{t('subtitle')}</p>}
        </div>

        <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-bold text-teal-900">{t('safeTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-teal-800">{t('safeBody')}</p>
        </div>

        {resultText === null ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={handleFillSample}>{t('fillSample')}</Button>
              <span className="text-xs text-gray-400">{t('sampleNote')}</span>
            </div>

            <IntakeFormFields
              selectedOptionIds={selectedOptionIds}
              onToggleOption={handleToggleOption}
              freeText={freeText}
              onFreeTextChange={setFreeText}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 py-6 text-base"
            >
              {t('submit')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm leading-relaxed text-gray-600">{t('resultLead')}</p>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">{t('beforeTitle')}</CardTitle>
                <p className="text-xs text-gray-400">{t('beforeNote')}</p>
              </CardHeader>
              <CardContent>
                <SpanText text={resultText} spans={spans} masked={false} />
              </CardContent>
            </Card>

            <Card className="border-teal-200">
              <CardHeader>
                <CardTitle className="text-base font-medium">{t('afterTitle')}</CardTitle>
                <p className="text-xs text-gray-400">{t('afterNote')}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <SpanText text={resultText} spans={spans} masked />
                <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
                  <span className="text-xs font-medium text-gray-600">
                    {spans.length > 0 ? t('foundCount', { count: spans.length }) : t('foundNone')}
                  </span>
                  {[...counts.entries()].map(([cat, n]) => (
                    <span key={cat} className={`text-xs rounded-full border px-2 py-0.5 ${CATEGORY_CLASSES[cat]}`}>
                      {t(`categories.${cat}`)} × {n}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">{t('limitTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">{t('limitBody')}</p>
              <p className="mt-2 text-xs leading-relaxed text-amber-800">{t('limitAiNote')}</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800">{t('nextTitle')}</h2>
              <p className="mt-1 text-xs text-gray-500">{t('nextLead')}</p>

              <ol className="mt-4 space-y-2">
                <NextStep number={1} title={t('next1Title')} description={t('next1')} exampleTag={t('exampleTag')}>
                  <p className="text-sm font-bold text-gray-800">{t('mockCaseTitle')}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {MOCK_GOALS.map((goal) => (
                      <span key={goal} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: SDG_COLORS[goal] + '20', color: SDG_COLORS[goal] }}>
                        {tWord(String(goal))}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 rounded-lg bg-gradient-to-br from-blue-50 to-teal-50 p-3 text-xs leading-relaxed text-gray-700">{t('mockAiMessage')}</p>
                </NextStep>

                <NextStep number={2} title={t('next2Title')} description={t('next2')} exampleTag={t('exampleTag')}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg">🤝</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{t('mockOrgName')}</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">{t('mockOfferMessage')}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-center text-xs font-bold text-white">{t('mockApprove')}</span>
                    <span className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-600">{t('mockDecline')}</span>
                  </div>
                </NextStep>

                <NextStep number={3} title={t('next3Title')} description={t('next3')} exampleTag={t('exampleTag')} last>
                  <div className="space-y-2">
                    <p className="mr-8 rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-xs leading-relaxed text-gray-700">{t('mockChatSupporter')}</p>
                    <p className="ml-8 rounded-2xl rounded-tr-sm bg-teal-600 px-3 py-2 text-xs leading-relaxed text-white">{t('mockChatUser')}</p>
                  </div>
                </NextStep>
              </ol>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{t('ctaSosTitle')}</p>
                <Link href="/signup" className="mt-2 block rounded-lg bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-3 text-center text-sm font-bold text-white hover:from-blue-700 hover:to-teal-700">
                  {t('ctaSos')}
                </Link>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{t('ctaSupporterTitle')}</p>
                <a href={SUPPORTER_RECRUIT_URL} target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-lg border border-teal-600 px-4 py-3 text-center text-sm font-bold text-teal-700 hover:bg-teal-50">
                  {t('ctaSupporter')}
                </a>
              </div>
            </div>

            <Button type="button" variant="outline" onClick={handleRetry} className="w-full">{t('retry')}</Button>
          </div>
        )}
      </main>
    </div>
  );
}
