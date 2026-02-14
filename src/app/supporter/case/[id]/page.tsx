'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SDG_COLORS, CASE_STATUS, STATUS_STEPS, formatRelativeDate } from '@/lib/constants/sdgs';

type Case = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CANCELLED' | 'CLOSED';
  created_at: string;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
};

type UserData = {
  real_name: string;
  display_name: string;
  role: string;
};

// ─── Status Pipeline ──────────────────────────────────────────
function StatusPipeline({ status }: { status: string }) {
  const info = CASE_STATUS[status as keyof typeof CASE_STATUS] || CASE_STATUS.OPEN;
  const stepColorMap: Record<number, string> = {
    1: 'bg-blue-400',
    2: 'bg-amber-400',
    3: 'bg-blue-500',
    4: 'bg-green-500',
  };
  const activeColor = stepColorMap[info.step] || 'bg-gray-400';

  return (
    <div className="flex items-center gap-0 my-3">
      {STATUS_STEPS.map((label, i) => {
        const stepNum = i + 1;
        const active = stepNum <= info.step;
        const current = stepNum === info.step;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${active ? `${activeColor} text-white` : 'bg-gray-200 text-gray-400'
                  } ${current ? 'ring-2 ring-offset-1 ring-blue-300' : ''}`}
              >
                {active ? '✓' : stepNum}
              </div>
              <span className={`text-[10px] ${active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${stepNum < info.step ? activeColor : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Case Card ────────────────────────────────────────────────
function CaseCard({
  case_,
  onDetail,
  onCancel,
  showCancel,
}: {
  case_: Case;
  onDetail: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}) {
  const statusInfo = CASE_STATUS[case_.status as keyof typeof CASE_STATUS] || CASE_STATUS.OPEN;
  const sdgs = case_.ai_sdg_suggestion?.sdgs_goals || [];

  return (
    <Card
      className={`border-l-4 ${statusInfo.borderColor} hover:shadow-md transition-all cursor-pointer`}
      onClick={onDetail}
    >
      <CardContent className="p-5">
        {/* ステータス & 緊急度 */}
        <div className="flex justify-between items-center mb-1">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
            {statusInfo.icon} {statusInfo.label}
          </span>
          {case_.urgency === 'High' && (
            <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">
              🔴 緊急
            </span>
          )}
        </div>

        {/* パイプライン */}
        {(case_.status === 'OPEN' || case_.status === 'MATCHED' || case_.status === 'RESOLVED') && (
          <StatusPipeline status={case_.status} />
        )}

        {/* タイトル & 詳細 */}
        <h3 className="text-[15px] font-bold text-gray-800 mb-1 leading-snug line-clamp-2">
          {case_.title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
          {case_.description_free}
        </p>

        {/* SDGタグ */}
        {sdgs.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {sdgs.slice(0, 4).map((g) => (
              <span
                key={g}
                className="text-white text-[11px] font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: SDG_COLORS[g] }}
              >
                SDG {g}
              </span>
            ))}
          </div>
        )}

        {/* サポーター接続エリア */}
        {case_.status === 'OPEN' && (
          <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center mb-3">
            <span className="text-xs text-gray-400">
              ⏳ サポーターからの連絡を待っています...
            </span>
          </div>
        )}
        {case_.status === 'MATCHED' && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
            <span className="text-sm font-semibold text-blue-700">
              🤝 サポーターがマッチしました！
            </span>
          </div>
        )}

        {/* アクション & 日付 */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            📅 {formatRelativeDate(case_.created_at)}
          </span>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={onDetail}>
              詳細を見る
            </Button>
            {showCancel && onCancel && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onCancel}
              >
                取消
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────
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
    title: string;
  }>({
    isOpen: false,
    caseId: '',
    title: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const { data: user } = await supabase
      .from('users')
      .select('real_name, display_name, role')
      .eq('auth_user_id', session.user.id)
      .single();

    if (!user || user.role !== 'SOS') { router.push('/'); return; }
    setUserData(user);

    const { data: userIdData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (!userIdData) return;

    const { data: casesData } = await supabase
      .from('cases')
      .select('*')
      .eq('owner_user_id', userIdData.id)
      .order('created_at', { ascending: false });

    setCases(casesData || []);
    setIsLoading(false);
  };

  const handleCancelCase = (caseId: string, title: string) => {
    setCancelModal({ isOpen: true, caseId, title });
  };

  const confirmCancel = async () => {
    const { error } = await supabase
      .from('cases')
      .update({ status: 'CANCELLED' })
      .eq('id', cancelModal.caseId);

    if (error) { toast.error('取消に失敗しました'); return; }

    toast.success('相談を取り消しました');
    setCancelModal({ isOpen: false, caseId: '', title: '' });
    loadData();
  };

  const handleStartNewCase = () => {
    const openCases = cases.filter(c => c.status === 'OPEN');
    if (openCases.length >= 3) {
      toast.warning('進行中の相談は最大3件までです。既存の相談を取り消してから新規登録してください。');
      return;
    }
    router.push('/sos/hearing');
  };

  const activeCases = cases.filter(c => c.status === 'OPEN' || c.status === 'MATCHED');
  const pastCases = cases.filter(c => ['RESOLVED', 'CANCELLED', 'CLOSED'].includes(c.status));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  // サマリー統計
  const stats = [
    { label: '進行中', value: activeCases.length, color: 'text-blue-600', icon: '📋' },
    { label: 'マッチ済み', value: cases.filter(c => c.status === 'MATCHED').length, color: 'text-green-600', icon: '🤝' },
    { label: '待ち', value: cases.filter(c => c.status === 'OPEN').length, color: 'text-amber-500', icon: '⏳' },
    { label: '解決済み', value: cases.filter(c => c.status === 'RESOLVED').length, color: 'text-gray-500', icon: '✅' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* ウェルカム */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            こんにちは、{userData?.real_name || userData?.display_name} さん 👋
          </h1>
          <p className="text-gray-500 mt-1">
            困りごとを相談して、支援につながりましょう
          </p>
        </div>

        {/* サマリー統計 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <div className="text-[11px] text-gray-400 mb-1">{s.icon} {s.label}</div>
              <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* 制限表示 & 新規相談 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            >
              ＋ 新しい相談を始める
            </Button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm rounded-md transition-all font-medium ${activeTab === 'active'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            📋 進行中 <span className="text-gray-400 ml-1">{activeCases.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 text-sm rounded-md transition-all font-medium ${activeTab === 'past'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            📚 過去の相談 <span className="text-gray-400 ml-1">{pastCases.length}</span>
          </button>
        </div>

        {/* 相談リスト */}
        {activeTab === 'active' && (
          activeCases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-500 mb-4">進行中の相談はありません</p>
                <Button
                  onClick={() => router.push('/sos/hearing')}
                  className="bg-gradient-to-r from-blue-600 to-green-600"
                >
                  最初の相談を始める
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeCases.map((c) => (
                <CaseCard
                  key={c.id}
                  case_={c}
                  onDetail={() => router.push(`/sos/result/${c.id}`)}
                  onCancel={() => handleCancelCase(c.id, c.title)}
                  showCancel={c.status === 'OPEN'}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'past' && (
          pastCases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-4xl mb-3">📁</div>
                <p className="text-gray-500">過去の相談はありません</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pastCases.map((c) => (
                <CaseCard
                  key={c.id}
                  case_={c}
                  onDetail={() => router.push(`/sos/result/${c.id}`)}
                  showCancel={false}
                />
              ))}
            </div>
          )
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

      <toast.ToastContainer />
    </div>
  );
}