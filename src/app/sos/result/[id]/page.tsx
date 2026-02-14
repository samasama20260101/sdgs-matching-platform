// ─────────────────────────────────────────────────────────────
// 📂 src/app/sos/result/[id]/page.tsx
// SOS相談結果ページ（AI分析・オファー管理・メッセージ）
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import MessageThread from '@/components/chat/MessageThread';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

type CaseData = {
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

type OfferData = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  supporter: {
    id: string;
    display_name: string;
    organization_name: string | null;
    supporter_type: string;
  };
};

const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d',
  5: '#ff3a21', 6: '#26bde2', 7: '#fcc30b', 8: '#a21942',
  9: '#fd6925', 10: '#dd1367', 11: '#fd9d24', 12: '#bf8b2e',
  13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 16: '#00689d',
  17: '#19486a',
};

const SDG_NAMES: Record<number, string> = {
  1: '貧困をなくそう', 2: '飢餓をゼロに', 3: 'すべての人に健康と福祉を',
  4: '質の高い教育をみんなに', 5: 'ジェンダー平等を実現しよう',
  6: '安全な水とトイレを世界中に', 7: 'エネルギーをみんなにそしてクリーンに',
  8: '働きがいも経済成長も', 9: '産業と技術革新の基盤をつくろう',
  10: '人や国の不平等をなくそう', 11: '住み続けられるまちづくりを',
  12: 'つくる責任つかう責任', 13: '気候変動に具体的な対策を',
  14: '海の豊かさを守ろう', 15: '陸の豊かさも守ろう',
  16: '平和と公正をすべての人に', 17: 'パートナーシップで目標を達成しよう',
};

export default function SOSResultPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [limitModal, setLimitModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferData | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const { data: caseResult, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', params.id)
      .single();

    if (caseError || !caseResult) {
      toast.error('相談が見つかりませんでした');
      router.push('/sos/dashboard');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (!userData || caseResult.owner_user_id !== userData.id) {
      toast.error('アクセス権限がありません');
      router.push('/sos/dashboard');
      return;
    }

    setCurrentUserId(userData.id);
    setCaseData(caseResult);

    if (!caseResult.ai_sdg_suggestion) {
      await runAIAnalysis(caseResult);
    }

    await loadOffers();
    setIsLoading(false);
  };

  const loadOffers = async () => {
    const { data: offersData, error: offersError } = await supabase
      .from('offers')
      .select('*')
      .eq('case_id', params.id)
      .in('status', ['PENDING', 'ACCEPTED'])
      .order('created_at', { ascending: false });

    if (offersError || !offersData) return;

    const offersWithSupporter = await Promise.all(
      offersData.map(async (offer) => {
        const { data: supporter } = await supabase
          .from('users')
          .select('id, display_name, organization_name, supporter_type')
          .eq('id', offer.supporter_user_id)
          .single();
        return {
          ...offer,
          supporter: supporter || { id: '', display_name: '不明', organization_name: null, supporter_type: 'NPO' },
        };
      })
    );
    setOffers(offersWithSupporter as OfferData[]);
  };

  const runAIAnalysis = async (cd: CaseData) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: cd.id, description: cd.description_free }),
      });
      if (!response.ok) { toast.error('AI分析に失敗しました'); return; }
      const result = await response.json();
      const { error: updateError } = await supabase
        .from('cases')
        .update({ ai_sdg_suggestion: result.analysis, visibility: 'LISTED' })
        .eq('id', cd.id);
      if (!updateError) {
        toast.success('AI分析が完了しました');
        setCaseData({ ...cd, ai_sdg_suggestion: result.analysis });
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error('AI分析に失敗しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!selectedOffer) return;
    const { error: offerError } = await supabase
      .from('offers')
      .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() })
      .eq('id', selectedOffer.id);
    if (offerError) { toast.error('承認に失敗しました'); return; }

    await supabase.from('cases').update({ status: 'MATCHED' }).eq('id', params.id);
    setShowAcceptModal(false);
    setSelectedOffer(null);
    await loadData();
    toast.success('サポーターを承認しました！メッセージでやり取りを始めましょう');
  };

  const handleDeclineOffer = async () => {
    if (!selectedOffer) return;
    const { error } = await supabase
      .from('offers')
      .update({ status: 'DECLINED', declined_at: new Date().toISOString() })
      .eq('id', selectedOffer.id);
    if (error) { toast.error('辞退に失敗しました'); return; }
    setShowDeclineModal(false);
    setSelectedOffer(null);
    await loadOffers();
    toast.success('申し出を辞退しました');
  };

  const handleNewConsultation = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const { data: uid } = await supabase.from('users').select('id').eq('auth_user_id', session.user.id).single();
    if (!uid) return;
    const { data: userCases } = await supabase.from('cases').select('id, status').eq('owner_user_id', uid.id).eq('status', 'OPEN');
    if ((userCases?.length || 0) >= 3) { setLimitModal(true); return; }
    router.push('/sos/hearing');
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const pendingOffers = offers.filter(o => o.status === 'PENDING');
  const acceptedOffers = offers.filter(o => o.status === 'ACCEPTED');
  const hasAccepted = acceptedOffers.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Button variant="outline" onClick={() => router.push('/sos/dashboard')} className="mb-4">
          ← ダッシュボードに戻る
        </Button>

        {/* AI分析結果 */}
        {isAnalyzing ? (
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">AI分析中...</p>
            </CardContent>
          </Card>
        ) : caseData?.ai_sdg_suggestion ? (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">🤖 AI分析結果</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">関連するSDGsゴール</p>
                <div className="flex flex-wrap gap-2">
                  {caseData.ai_sdg_suggestion.sdgs_goals?.map((goalId) => (
                    <div key={goalId} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: `${SDG_COLORS[goalId]}20` }}>
                      <span className="text-white text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: SDG_COLORS[goalId] }}>
                        SDG {goalId}
                      </span>
                      <span className="text-sm font-medium">{SDG_NAMES[goalId]}</span>
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
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">{caseData.ai_sdg_suggestion.reasoning}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ───── 承認済みサポーター + メッセージ ───── */}
        {hasAccepted && (
          <div className="mb-6 space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-base text-green-800">
                  ✅ 承認済みのサポーター ({acceptedOffers.length}名)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {acceptedOffers.map((offer) => (
                  <div key={offer.id} className="bg-white p-4 rounded-lg border border-green-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-800">
                          {offer.supporter.organization_name || offer.supporter.display_name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {offer.supporter.supporter_type === 'NPO' ? 'NPO/支援組織' : '企業'}
                        </p>
                      </div>
                      <span className="text-xs text-green-600">{formatDate(offer.created_at)}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-700">{offer.message}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 💬 メッセージスレッド */}
            {currentUserId && (
              <MessageThread caseId={caseData!.id} currentUserId={currentUserId} />
            )}
          </div>
        )}

        {/* ───── 新しいオファー ───── */}
        {pendingOffers.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">💌 新しい支援の申し出 ({pendingOffers.length}件)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingOffers.map((offer) => (
                <div key={offer.id} className="border border-gray-200 p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-800">
                        {offer.supporter.organization_name || offer.supporter.display_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {offer.supporter.supporter_type === 'NPO' ? 'NPO/支援組織' : '企業'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(offer.created_at)}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded mb-3">
                    <p className="text-sm text-gray-700">{offer.message}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => { setSelectedOffer(offer); setShowAcceptModal(true); }} className="flex-1 bg-green-600 hover:bg-green-700">
                      ✅ 承認する
                    </Button>
                    <Button onClick={() => { setSelectedOffer(offer); setShowDeclineModal(true); }} variant="outline" className="flex-1 text-red-600 hover:bg-red-50">
                      辞退する
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* オファーがない場合 */}
        {offers.length === 0 && caseData?.ai_sdg_suggestion && (
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-3">⏳</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">サポーターからの申し出を待っています</h3>
              <p className="text-sm text-gray-500">AIがSDGsゴールに基づいて、適切なサポーターにあなたの相談を届けています</p>
            </CardContent>
          </Card>
        )}

        {/* アクション */}
        <div className="flex gap-3">
          <Button onClick={handleNewConsultation} variant="outline" className="flex-1">別の相談を投稿</Button>
          <Button onClick={() => router.push('/sos/dashboard')} className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
            ダッシュボードへ
          </Button>
        </div>
      </main>

      {/* モーダル群 */}
      <Modal isOpen={showAcceptModal} onClose={() => setShowAcceptModal(false)} title="サポーターを承認しますか？" type="info">
        <div className="space-y-4">
          <p className="text-gray-700">
            <span className="font-medium">{selectedOffer?.supporter.organization_name || selectedOffer?.supporter.display_name}</span>
            からの支援を承認します。
          </p>
          <p className="text-sm text-gray-500">承認後、メッセージでやり取りができるようになります。</p>
          <div className="flex gap-3">
            <button onClick={() => setShowAcceptModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">キャンセル</button>
            <button onClick={handleAcceptOffer} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">承認する</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeclineModal} onClose={() => setShowDeclineModal(false)} title="この申し出を辞退しますか？" type="warning">
        <div className="space-y-4">
          <p className="text-gray-700">
            <span className="font-medium">{selectedOffer?.supporter.organization_name || selectedOffer?.supporter.display_name}</span>
            からの支援を辞退します。
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeclineModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">キャンセル</button>
            <button onClick={handleDeclineOffer} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">辞退する</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={limitModal} onClose={() => setLimitModal(false)} title="相談件数の上限に達しています" type="warning">
        <div className="text-center py-4">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 mb-4 font-medium">進行中の相談は最大3件までです。</p>
          <p className="text-sm text-gray-600 mb-6">ダッシュボードから既存の相談を取り消してから、新しい相談を登録してください。</p>
          <button onClick={() => router.push('/sos/dashboard')} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            ダッシュボードへ戻る
          </button>
        </div>
      </Modal>

      <toast.ToastContainer />
    </div>
  );
}