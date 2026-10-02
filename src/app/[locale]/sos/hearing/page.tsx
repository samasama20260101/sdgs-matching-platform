// ─────────────────────────────────────────────────────────────
// 📂 src/app/sos/hearing/page.tsx
// SOS相談フォーム（ヒアリング）
// 設問・選択肢の文言は messages/*/sos.json（sos.questions）で管理。
// ここには ID・緊急フラグ・排他フラグだけを持つ（多言語化・バリアント対応の前提）。
// ─────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import IntakeFormFields, { CHAR_LIMITS, QA_QUESTIONS, toggleIntakeOption, type IntakeFreeText, type IntakeSelections, type QAOption, type QAQuestion } from '@/components/sos/IntakeFormFields';
import { Modal } from '@/components/ui/modal';

const MAX_ACTIVE_CASES = 3;

// ─── メインコンポーネント ────────────────────────────────────
export default function SOSHearingPage() {
  const t = useTranslations('sos.hearing');
  const tQ = useTranslations('sos.questions');
  const tLimit = useTranslations('sos.limitModal');
  const tForm = useTranslations('common.form');
  const router = useRouter();
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // AI処理ステップのラベル
  const AI_STEPS = [
    { icon: '📝', label: t('aiStep1') },
    { icon: '🤖', label: t('aiStep2') },
    { icon: '🌍', label: t('aiStep3') },
    { icon: '✨', label: t('aiStep4') },
  ];

  // 選択された回答（複数選択可）
  const [selectedOptionIds, setSelectedOptionIds] = useState<IntakeSelections>({});

  // 自由記述
  const [freeText, setFreeText] = useState<IntakeFreeText>({ what: '', when: '', want: '' });

  // ログイン確認
  useEffect(() => {
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
      const userCases = (casesData.cases || []).filter((c: { status: string }) => c.status === 'OPEN');
      if ((userCases?.length || 0) >= MAX_ACTIVE_CASES) { setShowLimitModal(true); return; }

    };
    checkAuth();
  }, [router]);

  const handleToggleOption = (question: QAQuestion, option: QAOption) => {
    setSelectedOptionIds(prev => toggleIntakeOption(prev, question, option));
  };


  // 自由記述専用の緊急語彙。機械翻訳だけで確定せず、ネイティブ/専門家確認が必要な暫定リスト。
  const detectUrgency = (text: string): boolean => {
    const urgentPhrases = [
      '死にたい', '自殺', '殺される', '消えたい', '限界', '助けて', '虐待', '暴力', '人身取引', '監禁', '戦争', '紛争',
      '想死', '不想活', '自杀', '自殺', '救命', '虐待', '暴力', '家暴', '人口贩卖', '人口販賣',
      '죽고 싶', '죽고싶', '자살', '도와주세요', '살려주', '학대', '폭력', '가정폭력', '인신매매', '전쟁',
      'want to die', 'kill myself', 'end my life', 'commit suicide', 'attempt suicide', 'suicidal thoughts',
      'suicide', 'suicidal', 'abuse', 'abused', 'violence', 'trafficked', 'trafficking',
      'muốn chết', 'muon chet', 'tự tử', 'muon tu tu', 'cứu tôi', 'cuu toi', 'bạo lực', 'bao luc', 'bạo hành', 'bao hanh', 'buôn người', 'buon nguoi', 'chiến tranh', 'chien tranh',
      'bunuh diri', 'ingin mati', 'mau mati', 'ingin bunuh diri', 'tolong saya', 'kekerasan', 'perdagangan orang', 'kdrt', 'penganiayaan', 'diculik',
    ];
    const normalizedText = text.toLowerCase();
    return urgentPhrases.some(phrase => normalizedText.includes(phrase.toLowerCase()));
  };

  const optionText = (questionId: number, optionId: string) => tQ(`q${questionId}.options.${optionId}`);

  const handleSubmit = async () => {
    setError(null);

    // バリデーション
    for (const q of QA_QUESTIONS) {
      const selected = selectedOptionIds[q.id]?.size || 0;
      if (selected === 0) {
        setError(t('errorAnswerRequired', { id: q.id }));
        return;
      }
    }

    if (!freeText.what.trim()) {
      setError(t('errorWhatRequired'));
      return;
    }
    if (freeText.what.length > CHAR_LIMITS.what) {
      setError(t('errorWhatTooLong', { max: CHAR_LIMITS.what }));
      return;
    }

    setIsSubmitting(true);
    setAiStep(0);

    // AIステップを1秒ごとに進める
    const stepInterval = setInterval(() => {
      setAiStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 1200);

    // 30秒でタイムアウト
    const timeoutId = setTimeout(() => {
      clearInterval(stepInterval);
      setIsSubmitting(false);
      setAiStep(0);
      setError(t('errorTimeout'));
    }, 30000);

    try {
      // 回答データ整形: qaは表示用の文字列配列（ユーザーが見た言語のスナップショット）、
      // qa_ids は言語横断集計用。
      const qaData: Record<number, string[]> = {};
      const qaIds: Record<number, string[]> = {};
      for (const q of QA_QUESTIONS) {
        const selectedIds = [...(selectedOptionIds[q.id] || [])];
        qaData[q.id] = selectedIds.map(id => optionText(q.id, id));
        qaIds[q.id] = selectedIds;
      }

      // 緊急度判定: 選択肢はurgentフラグ、自由記述は語彙リストで判定する。
      const hasUrgentChoice = QA_QUESTIONS.some(q =>
        [...(selectedOptionIds[q.id] || [])].some(id => q.options.find(option => option.id === id)?.urgent)
      );
      const freeTextForUrgency = Object.values(freeText).join(' ');
      const isUrgent = hasUrgentChoice || detectUrgency(freeTextForUrgency);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const roleRes2 = await fetch('/api/auth/get-role', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const roleData2 = await roleRes2.json();
      if (!roleData2.user) { setError(t('errorUserFetch')); setIsSubmitting(false); return; }

      const caseRes = await fetch('/api/sos/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          intake_qna: { qa: qaData, qa_ids: qaIds, locale },
          description_free: [
            freeText.what,
            freeText.when ? `${t('whenPrefix')}${freeText.when}` : '',
            freeText.want ? `${t('wantPrefix')}${freeText.want}` : '',
          ].filter(Boolean).join('\n'),
          title: freeText.what.slice(0, 50) || t('defaultTitle'),
          urgency: isUrgent ? 'High' : 'Medium',
          locale,
          status: 'OPEN',
          region_country: 'ID',
        }),
      });
      const caseResult = await caseRes.json();
      if (!caseRes.ok) {
        console.error('Case error:', caseResult);
        setError(t('errorSave', { message: caseResult.error }));
        setIsSubmitting(false);
        return;
      }
      const caseData = caseResult.case;


      clearInterval(stepInterval);
      clearTimeout(timeoutId);
      router.push(`/sos/result/${caseData.id}`);
    } catch (err) {
      console.error('Submit error:', err);
      clearInterval(stepInterval);
      clearTimeout(timeoutId);
      setError(t('errorSubmit'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
          <p className="text-gray-500 mt-1">{t('subtitle')}</p>
          <p className="text-xs text-gray-400 mt-2">{tQ('intro')}</p>
        </div>

        <div className="space-y-6">
          <IntakeFormFields
            selectedOptionIds={selectedOptionIds}
            onToggleOption={handleToggleOption}
            freeText={freeText}
            onFreeTextChange={setFreeText}
          />

          {/* エラーメッセージ */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* AI送信中オーバーレイ */}
          {isSubmitting && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-8 mx-6 max-w-sm w-full text-center">
                {/* ロゴアニメーション */}
                <div className="relative flex items-center justify-center mb-6">
                  <div className="absolute w-24 h-24 rounded-full bg-teal-100 animate-ping opacity-40" />
                  <div className="absolute w-16 h-16 rounded-full bg-teal-200 animate-pulse opacity-60" />
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-xl shadow-lg">
                    🤖
                  </div>
                </div>

                {/* メインメッセージ */}
                <h3 className="text-lg font-bold text-gray-800 mb-1">{t('aiOverlayTitle')}</h3>
                <p className="text-xs text-gray-400 mb-6">{t('aiPoweredBy')}</p>

                {/* ステップ表示 */}
                <div className="space-y-3 mb-6">
                  {AI_STEPS.map((step, i) => (
                    <div key={i} className={"flex items-center gap-3 text-left transition-all duration-500 " + (i <= aiStep ? "opacity-100" : "opacity-20")}>
                      <div className={"w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all " + (i < aiStep ? "bg-teal-100" : i === aiStep ? "bg-teal-500 text-white animate-pulse" : "bg-gray-100")}>
                        {i < aiStep ? "✓" : step.icon}
                      </div>
                      <span className={"text-sm " + (i === aiStep ? "text-teal-700 font-medium" : i < aiStep ? "text-gray-500 line-through" : "text-gray-400")}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* プログレスバー */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${((aiStep + 1) / AI_STEPS.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-3">{t('aiWait')}</p>
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 py-6 text-base"
          >
            {isSubmitting ? tForm('submitting') : t('submit')}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            {t('privacyNote')}
          </p>
        </div>
      </main>

      {/* 3件制限モーダル */}
      <Modal
        isOpen={showLimitModal}
        onClose={() => router.push('/sos/dashboard')}
        title={tLimit('title')}
        type="warning"
      >
        <div className="text-center py-4">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 mb-4 font-medium">{tLimit('heading')}</p>
          <p className="text-sm text-gray-600 mb-6">
            {tLimit('body')}
          </p>
          <button
            onClick={() => router.push('/sos/dashboard')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {tLimit('backToDashboard')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
