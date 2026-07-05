'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SDG_COLORS, CASE_STATUS, type CaseStatusKey } from '@/lib/constants/sdgs';

type Case = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  created_at: string;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
};

export default function SOSCasesPage() {
  const t = useTranslations('sos.casesList');
  const tStatus = useTranslations('sdgs.caseStatus');
  const tForm = useTranslations('common.form');
  const locale = useLocale();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCases = async () => {
      // ログイン確認
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // ユーザーID取得
      const casesRes = await fetch('/api/sos/cases', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const casesData = await casesRes.json();
      if (!casesRes.ok) {
        setError(t('errorUserFetch'));
        setIsLoading(false);
        return;
      }

      setCases(casesData.cases || []);
      setIsLoading(false);
    };

    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ステータスの表示ラベル（文言はカタログ・色はここで管理）
  const statusDisplay = (status: string) => {
    const color = (CASE_STATUS as Record<string, { color: string }>)[status]?.color || 'bg-gray-100 text-gray-500';
    const isKnown = status in CASE_STATUS;
    return { label: isKnown ? tStatus(status as CaseStatusKey) : status, color };
  };

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

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {t('title')}
            </h1>
            <p className="text-gray-500 mt-1">
              {t('count', { count: cases.length })}
            </p>
          </div>
          <Button
            onClick={() => router.push('/sos/hearing')}
            className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
          >
            {t('newCase')}
          </Button>
        </div>

        {/* エラー */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        {/* 相談がない場合 */}
        {cases.length === 0 && !error && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 mb-4">{t('empty')}</p>
              <Button
                onClick={() => router.push('/sos/hearing')}
                className="bg-gradient-to-r from-blue-600 to-teal-600"
              >
                {t('postFirst')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 相談一覧 */}
        <div className="space-y-4">
          {cases.map((c) => {
            const statusInfo = statusDisplay(c.status);

            return (
              <Card
                key={c.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/sos/result/${c.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      {c.title}
                    </CardTitle>
                    <div className="flex gap-2 flex-shrink-0">
                      {/* 緊急度 */}
                      {c.urgency === 'High' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">
                          {t('urgent')}
                        </span>
                      )}
                      {/* ステータス */}
                      <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* 詳細テキスト */}
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {c.description_free}
                  </p>

                  {/* SDGsゴール（AI分析済みの場合） */}
                  {c.ai_sdg_suggestion?.sdgs_goals ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{t('sdgsLabel')}</span>
                      <div className="flex gap-1">
                        {c.ai_sdg_suggestion.sdgs_goals.map((goalId) => (
                          <span
                            key={goalId}
                            className="text-white text-xs font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: SDG_COLORS[goalId] }}
                          >
                            {goalId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{t('sdgsPendingLabel')}</span>
                      <span className="text-xs text-orange-500">{t('notAnalyzed')}</span>
                    </div>
                  )}

                  {/* 日時 */}
                  <p className="text-xs text-gray-400">
                    📅 {formatDate(c.created_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ダッシュボードに戻る */}
        <div className="mt-8">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/sos/dashboard')}
          >
            {t('backToDashboard')}
          </Button>
        </div>
      </main>
    </div>
  );
}
