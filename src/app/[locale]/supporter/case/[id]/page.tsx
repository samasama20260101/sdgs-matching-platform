// ─────────────────────────────────────────────────────────────
// 📂 src/app/supporter/case/[id]/page.tsx
// サポーター案件詳細ページ（案件確認・申し出・メッセージ）
// RLS対策：全DB操作をAPIルート経由に変更済み
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { withLocalePath } from '@/i18n/routing';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import MessageThread from '@/components/chat/MessageThread';
import { InternalNotesPanel } from '@/components/supporter/InternalNotesPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SDG_COLORS, MAX_SUPPORTERS_PER_CASE } from '@/lib/constants/sdgs';
import { isMinor } from '@/lib/utils/age';

type CaseData = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  created_at: string;
  supporter_resolved_at: string | null;
  intake_qna: { qa: Record<string, string> };
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
  owner_user_id: string;
};

type OfferData = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  accepted_order: number | null;
};

// 設問本文は sos.questions.qN.question（SOSフォームと同一ソース）を参照する
const QA_QUESTION_IDS = [1, 2, 3, 4, 5];

const CASE_POLL_INTERVAL_MS = 60_000;

export default function SupporterCaseDetailPage() {
  const t = useTranslations('supporter.caseDetail');
  const tSupporter = useTranslations('supporter');
  const tSdgs = useTranslations('sdgs');
  const tQ = useTranslations('sos.questions');
  const tActions = useTranslations('common.actions');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [myOffer, setMyOffer] = useState<OfferData | null>(null);
  const [acceptedOfferOrders, setAcceptedOfferOrders] = useState<{
    supporter_user_id: string;
    supporter_organization_id: string;
    accepted_order: number;
    profile: { display_name: string; organization_name: string | null; supporter_type: string } | null;
  }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [ownerBirthDate, setOwnerBirthDate] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showQna, setShowQna] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) { router.push('/login'); return; }
    setAccessToken(token);

    // ケース取得（API経由でRLSバイパス）
    const caseRes = await fetch(`/api/supporter/cases/${params.id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!caseRes.ok) {
      toast.error(t('notFound'));
      router.push('/supporter/dashboard');
      return;
    }
    const { case: caseResult, supporterUserId, supporterOrganizationId, acceptedOffers: aOffers, ownerBirthDate: birthDate } = await caseRes.json();
    setCaseData(caseResult);
    setCurrentUserId(supporterUserId);
    setCurrentOrganizationId(supporterOrganizationId);
    setAcceptedOfferOrders(aOffers ?? []);
    setOwnerBirthDate(birthDate ?? null);

    // 自分のオファー取得（API経由）
    const offerRes = await fetch(`/api/supporter/cases/${params.id}/offer`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (offerRes.ok) {
      const { offer } = await offerRes.json();
      setMyOffer(offer);
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // 表示中のタブだけ定期更新する。DBのRealtime payloadをクライアントへ直接出さない。
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void loadData();
    };
    const intervalId = window.setInterval(refreshIfVisible, CASE_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadData]);

  const handleSubmitOffer = async () => {
    if (!offerMessage.trim()) { toast.warning(t('toastEnterMessage')); return; }
    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) { router.push('/login'); return; }

      let res: Response;
      if (myOffer && (myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED')) {
        // 既存オファーを再送（PATCH）
        res = await fetch(`/api/supporter/cases/${params.id}/offer`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            offerId: myOffer.id,
            message: offerMessage,
            status: 'PENDING',
            created_at: new Date().toISOString(),
          }),
        });
      } else {
        // 新規オファー（POST）
        res = await fetch(`/api/supporter/cases/${params.id}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ message: offerMessage }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'MAX_REACHED') {
          toast.error(t('toastMaxReached', { max: MAX_SUPPORTERS_PER_CASE }));
          setShowOfferModal(false);
          await loadData(); // 表示を最新化
        } else {
          toast.error(data.error === 'DUPLICATE' ? t('toastDuplicate') : t('toastOfferFailed'));
        }
        setIsSubmitting(false);
        return;
      }

      setShowOfferModal(false);
      setOfferMessage('');
      await loadData();
      toast.success(t('toastOfferSent'));
    } catch (err) {
      console.error('Submit offer error:', err);
      toast.error(t('toastGenericError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!myOffer || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/supporter/cases/${params.id}/offer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ offerId: myOffer.id, status: 'WITHDRAWN' }),
      });
      if (!res.ok) { toast.error(t('toastWithdrawFailed')); return; }
      setShowWithdrawModal(false);
      await loadData();
      toast.success(t('toastWithdrawn'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (!myOffer || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/supporter/cases/${params.id}/offer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ offerId: myOffer.id, status: 'WITHDRAWN', withdrawal_reason: cancelReason }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        toast.error(result.message || t('toastCancelFailed'));
        await loadData();
        return;
      }
      setShowCancelModal(false);
      setCancelReason('');
      toast.success(t('toastCancelled'));
      router.push('/supporter/dashboard');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReportResolution = async () => {
    if (isSubmitting) return;
    const token = await getToken();
    if (!token) return;

    setIsSubmitting(true);
    try {
      // ケースにsupporter_resolved_atをセット
      const res = await fetch(`/api/supporter/cases/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ supporter_resolved_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        toast.error(result.message || t('toastResolveConflict'));
        await loadData();
        return;
      }

      setShowResolveModal(false);
      await loadData();
      toast.success(t('toastResolveReported'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  const MAX_ACCEPTED = MAX_SUPPORTERS_PER_CASE
  const caseIsFull = acceptedOfferOrders.length >= MAX_ACCEPTED
  // DECLINED の場合でも、案件が満員なら再申し出不可
  const canSendOffer = (!myOffer || myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED') && !caseIsFull;
  const shouldShowOffer = myOffer && myOffer.status !== 'WITHDRAWN' && myOffer.status !== 'DECLINED';
  const isAccepted = myOffer?.status === 'ACCEPTED';
  const hasReportedResolution = !!caseData?.supporter_resolved_at;

  // 解決ボタン表示ロジック：
  // 承認済みの中で最小のaccepted_orderを持つ人が「主」= 解決ボタン押下可
  // 主が辞退した場合は次のorderの人が自動的に主になる
  const myOrder = myOffer?.accepted_order ?? null;
  const minOrder = acceptedOfferOrders.length > 0
    ? Math.min(...acceptedOfferOrders.map(o => o.accepted_order))
    : null;
  const isPrimarySupporter = isAccepted && myOrder !== null && myOrder === minOrder;
  const canResolve = isPrimarySupporter;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{tSupporter('loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Button variant="outline" onClick={() => router.push('/supporter/dashboard')} className="mb-4">
          ← {t('backToDashboard')}
        </Button>

        {/* 案件詳細カード */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{caseData?.title}</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {caseData?.urgency === 'High' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">⚠️ {t('urgent')}</span>
                  )}
                  {isMinor(ownerBirthDate) && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                      🔰 {t('minor')}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${caseData?.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' :
                        caseData?.status === 'OPEN' ? 'bg-blue-100 text-blue-600' :
                          caseData?.status === 'RESOLVED' ? 'bg-teal-50 text-teal-600' :
                            'bg-gray-100 text-gray-600'
                    }`}>
                    {caseData?.status === 'MATCHED' ? `🤝 ${tSdgs('caseStatus.MATCHED')}` :
                        caseData?.status === 'OPEN' ? `⏳ ${tSdgs('caseStatus.OPEN')}` :
                          caseData?.status === 'RESOLVED' ? `✅ ${tSdgs('caseStatus.RESOLVED')}` : caseData?.status}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    📅 {formatDate(caseData?.created_at || '')}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">{t('detailsTitle')}</h3>
              <p className="text-gray-700 whitespace-pre-line">{caseData?.description_free}</p>
            </div>

            {/* Q1〜Q5 アンケート回答（折りたたみ） */}
            {caseData?.intake_qna?.qa && Object.keys(caseData.intake_qna.qa).length > 0 && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowQna(v => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 w-full text-left"
                >
                  <span>{showQna ? '▲' : '▼'}</span>
                  <span>{showQna ? t('qnaClose') : t('qnaOpen')}</span>
                </button>
                  {showQna && (
                  <div className="mt-3 space-y-3">
                    {QA_QUESTION_IDS.map((qId) => {
                      // 保存時のキーは数値（1,2,3...）または文字列（"q1","q2"...）の両方に対応
                      const answer = caseData.intake_qna?.qa?.[qId] ?? caseData.intake_qna?.qa?.[`q${qId}`]
                      if (!answer || (Array.isArray(answer) && answer.length === 0)) return null
                      const answerText = Array.isArray(answer) ? answer.join('\n') : answer
                      return (
                        <div key={qId} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Q{qId}. {tQ(`q${qId}.question`)}</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{answerText}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {caseData?.ai_sdg_suggestion && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3">🤖 {t('aiTitle')}</h3>
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">{t('aiGoals')}</p>
                  <div className="flex flex-wrap gap-2">
                    {caseData.ai_sdg_suggestion.sdgs_goals?.map((goalId) => (
                      <div key={goalId} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: `${SDG_COLORS[goalId]}20` }}>
                        <span className="text-white text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: SDG_COLORS[goalId] }}>
                          SDG {goalId}
                        </span>
                        <span className="text-sm font-medium">{tSdgs(`goal.${goalId}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {caseData.ai_sdg_suggestion.keywords && (
                  <div className="flex flex-wrap gap-2">
                    {caseData.ai_sdg_suggestion.keywords.map((kw, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">#{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 進行バー */}
        {isAccepted && (
          <Card className="mb-6 border-none bg-white shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">📊 {t('progressTitle')}</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${caseData?.status === 'RESOLVED' ? 'bg-teal-50 text-teal-600' :
                    hasReportedResolution ? 'bg-emerald-100 text-emerald-600' :
                      caseData?.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                  }`}>
                  {caseData?.status === 'MATCHED' && !hasReportedResolution && `🤝 ${tSdgs('caseStatus.MATCHED')}`}
                  {caseData?.status === 'MATCHED' && hasReportedResolution && `📋 ${t('reportedBadge')}`}
                  {caseData?.status === 'RESOLVED' && `✅ ${tSdgs('caseStatus.RESOLVED')}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[t('stepMatched'), t('stepReported'), t('stepDone')].map((step, i) => {
                  const stepNum = i + 1;
                  const currentStep =
                    caseData?.status === 'MATCHED' && !hasReportedResolution ? 1 :
                      caseData?.status === 'MATCHED' && hasReportedResolution ? 2 :
                        caseData?.status === 'RESOLVED' ? 3 : 0;
                  const isActive = stepNum <= currentStep;
                  const isCurrent = stepNum === currentStep;
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center">
                      <div className={`w-full h-2 rounded-full ${isActive ? 'bg-gradient-to-r from-blue-500 to-teal-500' : 'bg-gray-200'}`} />
                      <span className={`text-[11px] mt-1 ${isCurrent ? 'font-bold text-gray-800' : isActive ? 'text-gray-600' : 'text-gray-400'}`}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 担当サポーター一覧（承認済みが2名以上のとき表示） */}
        {isAccepted && acceptedOfferOrders.length > 1 && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('supportersTitle')}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {acceptedOfferOrders.map((o, i) => {
                  const isMe = o.supporter_organization_id === currentOrganizationId
                  const label = i === 0 ? t('primary') : t('secondary')
                  const labelColor = i === 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                  const name = o.profile?.organization_name || o.profile?.display_name || t('unknown')
                  const initial = name.charAt(name.length - 1)
                  const avatarColor = isMe
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                  return (
                    <div key={o.supporter_organization_id} className={`flex items-center gap-3 p-3 rounded-lg border ${isMe ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${avatarColor}`}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${labelColor}`}>{label}</span>
                          {isMe && <span className="text-[10px] text-gray-400">{t('you')}</span>}
                        </div>
                        {o.profile?.supporter_type && (
                          <p className="text-xs text-gray-400 mt-0.5">{
                            o.profile.supporter_type === 'NPO' ? 'NPO' :
                            o.profile.supporter_type === 'CORPORATE' ? t('typeCorporate') : t('typeGovernment')
                          }</p>
                        )}
                      </div>
                      {!isMe && (
                        <a
                          href={withLocalePath(locale, `/supporters/${o.supporter_organization_id}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 flex-shrink-0"
                        >
                          {t('publicPage')}
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* オファーステータス */}
        {shouldShowOffer && myOffer ? (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">{t('offerStatusTitle')}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${myOffer.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      myOffer.status === 'ACCEPTED' ? 'bg-teal-50 text-teal-700' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                    {myOffer.status === 'PENDING' && `⏳ ${tSdgs('offerStatus.PENDING')}`}
                    {myOffer.status === 'ACCEPTED' && `✅ ${tSdgs('offerStatus.ACCEPTED')}`}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(myOffer.created_at)}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700 break-all whitespace-pre-wrap">{myOffer.message}</p>
                </div>
                {myOffer.status === 'PENDING' && (
                  <Button variant="outline" size="sm" onClick={() => setShowWithdrawModal(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    {t('withdrawButton')}
                  </Button>
                )}
                {myOffer.status === 'ACCEPTED' && caseData?.status === 'MATCHED' && !hasReportedResolution && (
                  <Button variant="outline" size="sm" onClick={() => setShowCancelModal(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full mt-1">
                    🚫 {t('cancelButton')}
                  </Button>
                )}
                {myOffer.status === 'ACCEPTED' && (
                  <div className={`p-3 rounded-lg border ${caseData?.status === 'RESOLVED' ? 'bg-teal-50 border-teal-200' :
                      hasReportedResolution ? 'bg-emerald-50 border-emerald-200' :
                        'bg-amber-50 border-amber-200'
                    }`}>
                    <p className={`text-sm ${caseData?.status === 'RESOLVED' ? 'text-teal-700' :
                        hasReportedResolution ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                      {caseData?.status === 'RESOLVED' ? `✅ ${t('resolvedNotice')}` :
                        hasReportedResolution ? `📋 ${t('reportedNotice')}` :
                          `🤝 ${t('acceptedNotice')}`}
                    </p>
                  </div>
                )}
                {myOffer.status === 'ACCEPTED' && caseData?.status === 'MATCHED' && !hasReportedResolution && canResolve && (
                  <Button onClick={() => setShowResolveModal(true)}
                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white">
                    ✅ {t('reportButton')}
                  </Button>
                )}
                {myOffer.status === 'ACCEPTED' && caseData?.status === 'MATCHED' && !hasReportedResolution && !canResolve && (
                  <div className="w-full text-center text-sm text-gray-400 bg-gray-50 rounded-lg py-3 px-4">
                    🔒 {t('primaryOnly')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : canSendOffer ? (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-teal-50 border-none">
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{t('ctaTitle')}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {myOffer && (myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED')
                  ? t('ctaRetry')
                  : t('ctaBody')}
              </p>
              <Button onClick={() => setShowOfferModal(true)} className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700">
                💙 {t('ctaButton')}
              </Button>
            </CardContent>
          </Card>
        ) : caseIsFull && myOffer?.status === 'DECLINED' ? (
          <Card className="mb-6 border-gray-200">
            <CardContent className="py-6 text-center">
              <p className="text-2xl mb-2">🔒</p>
              <p className="text-sm font-medium text-gray-600">{t('fullTitle', { max: MAX_SUPPORTERS_PER_CASE })}</p>
              <p className="text-xs text-gray-400 mt-1">{t('fullBody')}</p>
            </CardContent>
          </Card>
        ) : null}

        {/* メッセージスレッド */}
        {isAccepted && currentUserId && accessToken && (
          <div className="mb-6">
            <MessageThread
              caseId={caseData!.id}
              currentUserId={currentUserId}
              accessToken={accessToken}
              readOnly={caseData?.status === 'RESOLVED' || caseData?.status === 'CLOSED' || caseData?.status === 'CANCELLED'}
            />
          </div>
        )}

        {isAccepted && accessToken && (
          <InternalNotesPanel caseId={caseData!.id} accessToken={accessToken} />
        )}
      </main>

      <Modal isOpen={showOfferModal} onClose={() => setShowOfferModal(false)} title={t('offerModalTitle')} type="info">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('offerModalBody')}</p>
          <div className="space-y-2">
            <Label htmlFor="offerMessage">{t('messageLabel')} <span className="text-red-500">*</span></Label>
            <textarea id="offerMessage" rows={5}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('offerPlaceholder')}
              maxLength={1000}
              value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} />
            <p className={`text-xs text-right mt-1 ${offerMessage.length >= 900 ? 'text-orange-500' : 'text-gray-400'}`}>{offerMessage.length} / 1000</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowOfferModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" disabled={isSubmitting}>{tActions('cancel')}</button>
            <button onClick={handleSubmitOffer} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting || !offerMessage.trim()}>
              {isSubmitting ? t('sending') : tActions('send')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} title={t('withdrawModalTitle')} type="warning">
        <div className="space-y-4">
          <p className="text-gray-700">{t('withdrawModalBody')}</p>
          <p className="text-sm text-gray-500">{t('withdrawModalNote')}</p>
          <div className="flex gap-3">
            <button onClick={() => setShowWithdrawModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{tActions('cancel')}</button>
            <button onClick={confirmWithdraw} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" disabled={isActionLoading}>{t('withdrawConfirm')}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title={t('cancelModalTitle')} type="warning">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-800">⚠️ {t('cancelModalWarn')}</p>
            <p className="text-sm text-red-700 mt-1">{t('cancelModalBody')}</p>
          </div>
          <p className="text-sm text-gray-500">{t('cancelModalNote')}</p>
          <div className="space-y-2">
            <Label htmlFor="cancelReason">{t('cancelReasonLabel')} <span className="text-red-500">*</span></Label>
            <textarea id="cancelReason" rows={4} maxLength={1000} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="w-full rounded-lg border border-gray-200 p-3 text-sm" placeholder={t('cancelReasonPlaceholder')} />
            <p className="text-right text-xs text-gray-400">{cancelReason.length} / 1000</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCancelModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{tActions('back')}</button>
            <button onClick={confirmCancel} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50" disabled={isActionLoading || !cancelReason.trim()}>
              {isActionLoading ? t('processing') : t('cancelConfirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} title={t('resolveModalTitle')} type="info">
        <div className="space-y-4">
          <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
            <p className="text-sm text-teal-700">✅ {t('resolveModalBody')}</p>
          </div>
          <p className="text-sm text-gray-500">{t('resolveModalNote')}</p>
          <div className="flex gap-3">
            <button onClick={() => setShowResolveModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{tActions('cancel')}</button>
            <button onClick={handleReportResolution} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? t('sending') : t('reportButton')}</button>
          </div>
        </div>
      </Modal>

      <toast.ToastContainer />
    </div>
  );
}
