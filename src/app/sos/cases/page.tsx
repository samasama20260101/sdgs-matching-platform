'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

// SDGsゴールの色
const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d',
  5: '#ff3a21', 6: '#26bde2', 7: '#fcc30b', 8: '#a21942',
  9: '#fd6925', 10: '#dd1367', 11: '#fd9d24', 12: '#bf8b2e',
  13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 16: '#00689d',
  17: '#19486a',
};

// ステータスの日本語表示
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN:        { label: '受付中',   color: 'bg-blue-100 text-blue-600' },
  IN_PROGRESS: { label: '対応中',   color: 'bg-yellow-100 text-yellow-600' },
  DONE:        { label: '解決済み', color: 'bg-green-100 text-green-600' },
  CANCELED:    { label: 'キャンセル', color: 'bg-gray-100 text-gray-500' },
};

export default function SOSCasesPage() {
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
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!userData) {
        setError('ユーザー情報が取得できませんでした');
        setIsLoading(false);
        return;
      }

      // 相談履歴取得（新しい順）
      const { data, error: fetchError } = await supabase
        .from('cases')
        .select('*')
        .eq('owner_user_id', userData.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError('相談履歴の取得に失敗しました');
        setIsLoading(false);
        return;
      }

      setCases(data || []);
      setIsLoading(false);
    };

    loadCases();
  }, [router]);

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
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
              相談履歴
            </h1>
            <p className="text-gray-500 mt-1">
              {cases.length}件の相談があります
            </p>
          </div>
          <Button
            onClick={() => router.push('/sos/hearing')}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            ＋ 新しい相談
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
              <p className="text-gray-500 mb-4">まだ相談がありません</p>
              <Button
                onClick={() => router.push('/sos/hearing')}
                className="bg-gradient-to-r from-blue-600 to-green-600"
              >
                最初の相談を投稿する
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 相談一覧 */}
        <div className="space-y-4">
          {cases.map((c) => {
            const statusInfo = STATUS_LABELS[c.status] || 
              { label: c.status, color: 'bg-gray-100 text-gray-500' };

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
                          ⚠️ 緊急
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
                      <span className="text-xs text-gray-400">SDGs:</span>
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
                      <span className="text-xs text-gray-400">SDGs分析:</span>
                      <span className="text-xs text-orange-500">未分析</span>
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
            onClick={() => router.push('/dashboard/sos')}
          >
            ダッシュボードへ戻る
          </Button>
        </div>
      </main>
    </div>
  );
}
