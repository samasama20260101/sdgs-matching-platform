'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SDG_COLORS, formatRelativeDateIntl } from '@/lib/constants/sdgs';
import { ACTIVE_DISASTER_EVENT, getDisasterEvent } from '@/lib/constants/disaster';

const MAX_ACTIVE_CASES = 3;

type Case = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CANCELLED' | 'CLOSED';
  pending_offer_count?: number;
  created_at: string;
  intake_qna?: { disaster?: { event_id?: string } } | null;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
};

type UserData = {
  display_name: string;
  role: string;
  sos_region_code: string | null;
};

export default function SOSDashboard() {
  const t = useTranslations('sos.dashboard');
  const tDisaster = useTranslations('sos.disaster');
  const tStatus = useTranslations('sdgs.caseStatus');
  const tForm = useTranslations('common.form');
  const tActions = useTranslations('common.actions');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [isLoading, setIsLoading] = useState(true);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    caseId: string;
    title: string
  }>({
    isOpen: false,
    caseId: '',
    title: '',
  });

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }


    // API経由でロール確認（RLSをバイパス）
    const roleRes = await fetch('/api/auth/get-role', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });

    // 停止済みアカウントは強制ログアウト
    if (roleRes.status === 403) {
      await supabase.auth.signOut();
      router.push('/login?reason=suspended');
      return;
    }

    const roleData = await roleRes.json();
    if (roleData.role !== 'SOS') {
      router.push('/');
      return;
    }

    if (!roleData.user) {
      router.push('/');
      return;
    }
    setUserData(roleData.user);

    const casesRes = await fetch('/api/sos/cases', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    const casesData = await casesRes.json()
    setCases(casesData.cases || [])
    setIsLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  const handleCancelCase = (caseId: string, title: string) => {
    setCancelModal({ isOpen: true, caseId, title });
  };

  const confirmCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/sos/cases/${cancelModal.caseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) {
        toast.error(t('toastCancelFailed'));
        return;
      }
      setCancelModal({ isOpen: false, caseId: '', title: '' });
      await loadData();
      toast.success(t('toastCancelled'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStartNewCase = () => {
    const openCases = cases.filter(c => ['OPEN', 'MATCHED'].includes(c.status));

    if (openCases.length >= MAX_ACTIVE_CASES) {
      toast.warning(t('toastLimit'));
      return;
    }

    router.push('/sos/hearing');
  };

  const urgencyLevel = (urgency: string) => {
    const key = urgency.toLowerCase();
    if (key === 'high') return { label: t('urgencyHigh'), color: 'text-red-600' };
    if (key === 'low') return { label: t('urgencyLow'), color: 'text-gray-600' };
    return { label: t('urgencyMed'), color: 'text-yellow-600' };
  };

  const activeCases = cases.filter(c => ['OPEN', 'MATCHED'].includes(c.status));
  const pastCases = cases.filter(c => ['RESOLVED', 'CANCELLED', 'CLOSED'].includes(c.status));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{tForm('loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ウェルカムメッセージ */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            {t('greeting', { name: userData?.display_name ?? '' })}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('subtitle')}
          </p>
        </div>

        {/* 災害SOSバナー（受付中の災害イベントがあるときだけ表示） */}
        {ACTIVE_DISASTER_EVENT && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-rose-50 border border-rose-200 rounded-xl px-5 py-4">
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-700">
                🆘 {tDisaster('banner.title', { event: tDisaster(`events.${ACTIVE_DISASTER_EVENT.i18nKey}`) })}
              </p>
              <p className="text-xs text-rose-600/90 leading-relaxed mt-1">
                {tDisaster('banner.body')}
              </p>
            </div>
            <button
              onClick={() => router.push('/sos/disaster')}
              className="flex-shrink-0 self-start sm:self-auto px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {tDisaster('banner.cta')}
            </button>
          </div>
        )}

        {/* 地域未設定バナー */}
        {!userData?.sos_region_code && (
          <div className="mb-6 flex items-start gap-4 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4">
            <span className="text-2xl flex-shrink-0">📍</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 mb-1">
                {t('regionBannerTitle')}
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                {t('regionBannerBody')}
              </p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {t('regionBannerAction')}
            </button>
          </div>
        )}

        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'active'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {t('tabActive')}
            {activeCases.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                {activeCases.length}
              </span>
            )}
            {activeTab === 'active' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'past'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {t('tabPast')}
            {pastCases.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {pastCases.length}
              </span>
            )}
            {activeTab === 'past' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
        </div>

        {/* 進行中の相談 */}
        {activeTab === 'active' && (
          <div className="space-y-6">
            {/* 制限表示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {t('limitCurrent', { count: activeCases.length, max: MAX_ACTIVE_CASES })}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {activeCases.length < MAX_ACTIVE_CASES
                      ? t('limitRemaining', { count: MAX_ACTIVE_CASES - activeCases.length })
                      : t('limitReached')}
                  </p>
                </div>
                <Button
                  onClick={handleStartNewCase}
                  className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                >
                  {t('newCase')}
                </Button>
              </div>
            </div>

            {/* 進行中の相談カード */}
            {activeCases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500 mb-4">{t('emptyActive')}</p>
                  <Button
                    onClick={() => router.push('/sos/hearing')}
                    className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                  >
                    {t('startFirst')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeCases.map((case_) => {
                  const urgency = urgencyLevel(case_.urgency);
                  return (
                    <Card key={case_.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-semibold line-clamp-2">
                            {case_.title}
                          </CardTitle>
                          <span className={`text-xs font-medium ${urgency.color}`}>
                            {t('urgencyLabel', { level: urgency.label })}
                          </span>
                        </div>
                        {/* 災害SOSバッジ */}
                        {(() => {
                          const disasterEvent = getDisasterEvent(case_.intake_qna?.disaster?.event_id);
                          return disasterEvent ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit bg-rose-100 text-rose-700 font-medium">
                              🆘 {tDisaster(`events.${disasterEvent.i18nKey}`)}
                            </span>
                          ) : null;
                        })()}
                        {/* ステータスバッジ */}
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${case_.status === 'OPEN' ? 'bg-blue-100 text-blue-600' :
                          case_.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' :
                              'bg-gray-100 text-gray-600'
                          }`}>
                          {case_.status === 'OPEN' && `⏳ ${tStatus('OPEN')}`}
                          {case_.status === 'MATCHED' && `🤝 ${tStatus('MATCHED')}`}
                        </span>
                        {case_.status === 'OPEN' && (case_.pending_offer_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                            {t('offerCount', { count: case_.pending_offer_count ?? 0 })}
                          </span>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {case_.description_free}
                        </p>

                        {case_.ai_sdg_suggestion?.sdgs_goals && (
                          <div className="flex flex-wrap gap-1">
                            {case_.ai_sdg_suggestion.sdgs_goals.slice(0, 3).map((goal) => (
                              <span
                                key={goal}
                                className="px-2 py-0.5 text-xs font-medium text-white rounded"
                                style={{ backgroundColor: SDG_COLORS[goal] }}
                              >
                                SDG {goal}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-gray-400">
                          📅 {formatRelativeDateIntl(case_.created_at, locale)}
                        </p>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/sos/result/${case_.id}`)}
                            className="flex-1"
                          >
                            {t('viewDetails')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelCase(case_.id, case_.title)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {t('cancelAction')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 過去の相談 */}
        {activeTab === 'past' && (
          <div className="space-y-4">
            {pastCases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">{t('emptyPast')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pastCases.map((case_) => (
                  <Card key={case_.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-800">{case_.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${case_.status === 'RESOLVED'
                              ? 'bg-teal-50 text-teal-700'
                              : 'bg-gray-100 text-gray-600'
                              }`}>
                              {case_.status === 'RESOLVED' ? `✓ ${tStatus('RESOLVED')}` : tStatus('CANCELLED')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                            {case_.description_free}
                          </p>
                          <p className="text-xs text-gray-400">
                            📅 {formatRelativeDateIntl(case_.created_at, locale)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/sos/result/${case_.id}`)}
                        >
                          {t('details')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 取消確認モーダル */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, caseId: '', title: '' })}
        title={t('cancelModalTitle')}
        type="warning"
      >
        <p className="text-gray-700 mb-4">
          {t('cancelModalBody', { title: cancelModal.title })}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          {t('cancelModalNote')}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setCancelModal({ isOpen: false, caseId: '', title: '' })}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {tActions('cancel')}
          </button>
          <button
            onClick={confirmCancel}
            disabled={isCancelling}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {t('cancelConfirm')}
          </button>
        </div>
      </Modal>

      {/* Toast表示 */}
      <toast.ToastContainer />
    </div>
  );
}
