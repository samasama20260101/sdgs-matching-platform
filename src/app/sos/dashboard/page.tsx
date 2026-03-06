'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

type Case = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED' | 'CLOSED';
  pending_offer_count?: number;
  created_at: string;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
};

type UserData = {
  display_name: string;
  role: string;
};

// SDGsゴールの色
const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d',
  5: '#ff3a21', 6: '#26bde2', 7: '#fcc30b', 8: '#a21942',
  9: '#fd6925', 10: '#dd1367', 11: '#fd9d24', 12: '#bf8b2e',
  13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 16: '#00689d',
  17: '#19486a',
};

// 緊急度の表示
const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: '低', color: 'text-gray-600' },
  med: { label: '中', color: 'text-yellow-600' },
  high: { label: '高', color: 'text-red-600' },
};

export default function SOSDashboard() {
  const router = useRouter();
  const toast = useToast();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [isLoading, setIsLoading] = useState(true);

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
      toast.error('取消に失敗しました');
      return;
    }

    toast.success('相談を取り消しました');
    setCancelModal({ isOpen: false, caseId: '', title: '' });
    loadData();
  };

  const handleStartNewCase = () => {
    const openCases = cases.filter(c => ['OPEN', 'MATCHED', 'IN_PROGRESS'].includes(c.status));

    if (openCases.length >= 3) {
      toast.warning('進行中の相談は最大3件までです。既存の相談を取り消してから新規登録してください。');
      return;
    }

    router.push('/sos/hearing');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今日';
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
    return `${Math.floor(diffDays / 30)}ヶ月前`;
  };

  const activeCases = cases.filter(c => ['OPEN', 'MATCHED', 'IN_PROGRESS'].includes(c.status));
  const pastCases = cases.filter(c => ['RESOLVED', 'CANCELLED', 'CLOSED'].includes(c.status));

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

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ウェルカムメッセージ */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            こんにちは、{userData?.display_name} さん 👋
          </h1>
          <p className="text-gray-500 mt-1">
            困りごとを相談して、支援につながりましょう
          </p>
        </div>

        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'active'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            📋 進行中の相談
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
            📚 過去の相談
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
                    現在の相談: {activeCases.length} / 3件
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {activeCases.length < 3
                      ? `あと${3 - activeCases.length}件登録できます`
                      : '上限に達しています。既存の相談を取り消すと新規登録できます。'}
                  </p>
                </div>
                <Button
                  onClick={handleStartNewCase}
                  className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                >
                  ＋ 新しい相談を始める
                </Button>
              </div>
            </div>

            {/* 進行中の相談カード */}
            {activeCases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500 mb-4">進行中の相談はありません</p>
                  <Button
                    onClick={() => router.push('/sos/hearing')}
                    className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                  >
                    最初の相談を始める
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeCases.map((case_) => (
                  <Card key={case_.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-semibold line-clamp-2">
                          {case_.title}
                        </CardTitle>
                        <span className={`text-xs font-medium ${URGENCY_LABELS[case_.urgency]?.color || 'text-gray-600'}`}>
                          緊急度: {URGENCY_LABELS[case_.urgency]?.label || '中'}
                        </span>
                      </div>
                      {/* ステータスバッジ */}
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${case_.status === 'OPEN' ? 'bg-blue-100 text-blue-600' :
                        case_.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' :
                          case_.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-600' :
                            'bg-gray-100 text-gray-600'
                        }`}>
                        {case_.status === 'OPEN' && '⏳ サポーター待ち'}
                        {case_.status === 'MATCHED' && '🤝 マッチ済み'}
                        {case_.status === 'IN_PROGRESS' && '🔄 対応中'}
                      </span>
                      {case_.status === 'OPEN' && (case_.pending_offer_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                          🙋 申し出 {case_.pending_offer_count}件
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
                        📅 {formatDate(case_.created_at)}
                      </p>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/sos/result/${case_.id}`)}
                          className="flex-1"
                        >
                          詳細を見る
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelCase(case_.id, case_.title)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          取消
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                  <p className="text-gray-500">過去の相談はありません</p>
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
                              {case_.status === 'RESOLVED' ? '✓ 解決済み' : '取消済み'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                            {case_.description_free}
                          </p>
                          <p className="text-xs text-gray-400">
                            📅 {formatDate(case_.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/sos/result/${case_.id}`)}
                        >
                          詳細
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
        title="相談を取り消しますか？"
        type="warning"
      >
        <p className="text-gray-700 mb-4">
          「{cancelModal.title}」を取り消すと、サポーターからは見えなくなります。
        </p>
        <p className="text-sm text-gray-500 mb-6">
          ※ 取り消し後、新しい相談を登録できるようになります
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setCancelModal({ isOpen: false, caseId: '', title: '' })}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={confirmCancel}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            取り消す
          </button>
        </div>
      </Modal>

      {/* Toast表示 */}
      <toast.ToastContainer />
    </div>
  );
}