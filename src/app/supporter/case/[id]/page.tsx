// ─────────────────────────────────────────────────────────────
// 📂 src/app/supporter/case/[id]/page.tsx
// サポーター案件詳細ページ（案件確認・申し出・メッセージ）
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import MessageThread from '@/components/chat/MessageThread';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

type CaseData = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  created_at: string;
  supporter_resolved_at: string | null;
  intake_qna: {
    qa: Record<string, string>;
  };
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

export default function SupporterCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [myOffer, setMyOffer] = useState<OfferData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showStartProgressModal, setShowStartProgressModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.id]);

  // casesテーブルのリアルタイム監視（SOS側の拒否などを即座に反映）
  useEffect(() => {
    const channel = supabase
      .channel(`case-updates:${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cases',
          filter: `id=eq.${params.id}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      router.push('/supporter/dashboard');
      return;
    }
    setCaseData(caseResult);

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (!userData) { setIsLoading(false); return; }

    setCurrentUserId(userData.id);

    const { data: offerData } = await supabase
      .from('offers')
      .select('*')
      .eq('case_id', params.id)
      .eq('supporter_user_id', userData.id)
      .maybeSingle();

    setMyOffer(offerData);
    setIsLoading(false);
  };

  const handleSubmitOffer = async () => {
    if (!offerMessage.trim()) { toast.warning('メッセージを入力してください'); return; }
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', session.user.id).single();
      if (!userData) { toast.error('ユーザー情報が取得できませんでした'); setIsSubmitting(false); return; }

      if (myOffer && (myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED')) {
        const { error } = await supabase
          .from('offers')
          .update({ message: offerMessage, status: 'PENDING', created_at: new Date().toISOString() })
          .eq('id', myOffer.id);
        if (error) { toast.error('申し出の更新に失敗しました'); setIsSubmitting(false); return; }
      } else {
        const { error } = await supabase
          .from('offers')
          .insert([{ case_id: params.id, supporter_user_id: userData.id, message: offerMessage, status: 'PENDING' }]);
        if (error) {
          toast.error(error.code === '23505' ? '既に申し出を送信済みです' : '申し出の送信に失敗しました');
          setIsSubmitting(false);
          return;
        }
      }

      setShowOfferModal(false);
      setOfferMessage('');
      setIsSubmitting(false);
      await loadData();
      toast.success('支援の申し出を送信しました');
    } catch (err) {
      console.error('Submit offer error:', err);
      toast.error('エラーが発生しました');
      setIsSubmitting(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!myOffer) return;
    const { error } = await supabase
      .from('offers')
      .update({ status: 'WITHDRAWN' })
      .eq('id', myOffer.id)
      .select();

    if (error) { toast.error('取り下げに失敗しました: ' + error.message); return; }
    setShowWithdrawModal(false);
    await loadData();
    toast.success('申し出を取り下げました');
  };

  // MATCHED → IN_PROGRESS: サポーターが支援を開始する
  const handleStartProgress = async () => {
    const { error } = await supabase
      .from('cases')
      .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) { toast.error('ステータスの更新に失敗しました'); return; }
    setShowStartProgressModal(false);
    await loadData();
    toast.success('支援を開始しました！相談者と連携を進めましょう');
  };

  // IN_PROGRESS: サポーターが解決を報告する（supporter_resolved_at をセット）
  const handleReportResolution = async () => {
    const { error } = await supabase
      .from('cases')
      .update({ supporter_resolved_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) { toast.error('解決報告に失敗しました'); return; }

    // チャットにシステムメッセージを投稿してSOS側に通知
    if (currentUserId) {
      await supabase.from('messages').insert([{
        case_id: params.id as string,
        sender_user_id: currentUserId,
        content: '__SYSTEM__サポーターが解決を報告しました。問題が解決していれば確認をお願いします。まだ解決していない場合は差し戻しができます。',
      }]);
    }

    setShowResolveModal(false);
    await loadData();
    toast.success('解決を報告しました。相談者の確認をお待ちください');
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  const canSendOffer = !myOffer || myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED';
  const shouldShowOffer = myOffer && myOffer.status !== 'WITHDRAWN' && myOffer.status !== 'DECLINED';
  const isAccepted = myOffer?.status === 'ACCEPTED';
  const hasReportedResolution = !!caseData?.supporter_resolved_at;

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

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Button variant="outline" onClick={() => router.push('/supporter/dashboard')} className="mb-4">
          ← ダッシュボードに戻る
        </Button>

        {/* 案件詳細カード */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{caseData?.title}</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {caseData?.urgency === 'High' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">⚠️ 緊急</span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${caseData?.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' :
                    caseData?.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-600' :
                      caseData?.status === 'OPEN' ? 'bg-blue-100 text-blue-600' :
                        caseData?.status === 'RESOLVED' ? 'bg-green-100 text-green-600' :
                          'bg-gray-100 text-gray-600'
                    }`}>
                    {caseData?.status === 'MATCHED' ? '🤝 マッチ済み' :
                      caseData?.status === 'IN_PROGRESS' ? '🔄 対応中' :
                        caseData?.status === 'OPEN' ? '⏳ サポーター待ち' :
                          caseData?.status === 'RESOLVED' ? '✅ 解決済み' :
                            caseData?.status}
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
              <h3 className="text-sm font-medium text-gray-500 mb-2">詳細</h3>
              <p className="text-gray-700 whitespace-pre-line">{caseData?.description_free}</p>
            </div>

            {caseData?.ai_sdg_suggestion && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3">🤖 AI分析結果</h3>
                <div className="mb-3">
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* ───── 進行バー（承認済みの場合） ───── */}
        {isAccepted && (
          <Card className="mb-6 border-none bg-white shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">📊 進行状況</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${caseData?.status === 'RESOLVED'
                  ? 'bg-green-100 text-green-600' :
                  caseData?.status === 'IN_PROGRESS' && hasReportedResolution
                    ? 'bg-emerald-100 text-emerald-600' :
                    caseData?.status === 'IN_PROGRESS'
                      ? 'bg-purple-100 text-purple-600' :
                      caseData?.status === 'MATCHED'
                        ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                  }`}>
                  {caseData?.status === 'MATCHED' && '🤝 マッチ済み'}
                  {caseData?.status === 'IN_PROGRESS' && !hasReportedResolution && '🔄 対応中'}
                  {caseData?.status === 'IN_PROGRESS' && hasReportedResolution && '📋 解決報告あり'}
                  {caseData?.status === 'RESOLVED' && '✅ 解決済み'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {['マッチ', '対応中', '解決報告', '完了'].map((step, i) => {
                  const stepNum = i + 1;
                  const currentStep =
                    caseData?.status === 'MATCHED' ? 1 :
                      caseData?.status === 'IN_PROGRESS' && !hasReportedResolution ? 2 :
                        caseData?.status === 'IN_PROGRESS' && hasReportedResolution ? 3 :
                          caseData?.status === 'RESOLVED' ? 4 : 0;
                  const isActive = stepNum <= currentStep;
                  const isCurrent = stepNum === currentStep;
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center">
                      <div className={`w-full h-2 rounded-full ${isActive ? 'bg-gradient-to-r from-blue-500 to-green-500' : 'bg-gray-200'}`} />
                      <span className={`text-[11px] mt-1 ${isCurrent ? 'font-bold text-gray-800' : isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ───── オファーステータス ───── */}
        {shouldShowOffer && myOffer ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">あなたの申し出状況</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${myOffer.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    myOffer.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                    {myOffer.status === 'PENDING' && '⏳ 承認待ち'}
                    {myOffer.status === 'ACCEPTED' && '✅ 承認済み'}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(myOffer.created_at)}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">{myOffer.message}</p>
                </div>

                {myOffer.status === 'PENDING' && (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowWithdrawModal(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      申し出を取り下げる
                    </Button>
                  </div>
                )}

                {myOffer.status === 'ACCEPTED' && (
                  <div className={`p-3 rounded-lg border ${caseData?.status === 'RESOLVED'
                    ? 'bg-green-50 border-green-200'
                    : hasReportedResolution
                      ? 'bg-emerald-50 border-emerald-200'
                      : caseData?.status === 'IN_PROGRESS'
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-green-50 border-green-200'
                    }`}>
                    <p className={`text-sm ${caseData?.status === 'RESOLVED' ? 'text-green-700' :
                      hasReportedResolution ? 'text-emerald-700' :
                        caseData?.status === 'IN_PROGRESS' ? 'text-purple-700' : 'text-green-700'
                      }`}>
                      {caseData?.status === 'RESOLVED'
                        ? '✅ この相談は解決済みです。ご支援ありがとうございました。'
                        : hasReportedResolution
                          ? '📋 解決を報告済みです。相談者の確認をお待ちください。'
                          : caseData?.status === 'IN_PROGRESS'
                            ? '🔄 支援が進行中です。解決したら報告してください。'
                            : '💚 相談者があなたの支援を承認しました。支援を開始してください。'}
                    </p>
                  </div>
                )}

                {/* MATCHED + ACCEPTED → サポーターが支援を開始するボタン */}
                {myOffer.status === 'ACCEPTED' && caseData?.status === 'MATCHED' && (
                  <div className="pt-2">
                    <Button
                      onClick={() => setShowStartProgressModal(true)}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                    >
                      🚀 支援を開始する
                    </Button>
                  </div>
                )}

                {/* IN_PROGRESS + ACCEPTED + 未報告 → サポーターが解決を報告するボタン */}
                {myOffer.status === 'ACCEPTED' && caseData?.status === 'IN_PROGRESS' && !hasReportedResolution && (
                  <div className="pt-2">
                    <Button
                      onClick={() => setShowResolveModal(true)}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    >
                      ✅ 解決を報告する
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : canSendOffer ? (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-green-50 border-none">
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">この方を支援しませんか？</h3>
              <p className="text-sm text-gray-600 mb-4">
                {myOffer && (myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED')
                  ? '再度申し出を送信できます'
                  : 'あなたの組織で支援できる場合は、申し出を送信してください'}
              </p>
              <Button onClick={() => setShowOfferModal(true)} className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                💙 支援を申し出る
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* ───── 💬 メッセージスレッド（承認済みの場合） ───── */}
        {isAccepted && currentUserId && (
          <div className="mb-6">
            <MessageThread
              caseId={caseData!.id}
              currentUserId={currentUserId}
              readOnly={caseData?.status === 'RESOLVED' || caseData?.status === 'CLOSED' || caseData?.status === 'CANCELLED'}
            />
          </div>
        )}
      </main>

      {/* オファー送信モーダル */}
      <Modal isOpen={showOfferModal} onClose={() => setShowOfferModal(false)} title="支援の申し出" type="info">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">この方への支援について、メッセージを送信してください。</p>
          <div className="space-y-2">
            <Label htmlFor="offerMessage">メッセージ <span className="text-red-500">*</span></Label>
            <textarea
              id="offerMessage"
              rows={5}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="例：私たちの団体では、〇〇の支援を行っています。詳しくお話を伺わせていただけますか？"
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowOfferModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" disabled={isSubmitting}>
              キャンセル
            </button>
            <button onClick={handleSubmitOffer} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting ? '送信中...' : '送信する'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 取り下げ確認モーダル */}
      <Modal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} title="申し出を取り下げますか？" type="warning">
        <div className="space-y-4">
          <p className="text-gray-700">この申し出を取り下げると、相談者には表示されなくなります。</p>
          <p className="text-sm text-gray-500">※ 取り下げ後、再度申し出を送ることができます</p>
          <div className="flex gap-3">
            <button onClick={() => setShowWithdrawModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">キャンセル</button>
            <button onClick={confirmWithdraw} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">取り下げる</button>
          </div>
        </div>
      </Modal>

      {/* 支援開始確認モーダル */}
      <Modal isOpen={showStartProgressModal} onClose={() => setShowStartProgressModal(false)} title="支援を開始しますか？" type="info">
        <div className="space-y-4">
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-700">
              🚀 この相談への支援を正式に開始します。ステータスが「対応中」に変わります。
            </p>
          </div>
          <p className="text-sm text-gray-500">
            相談者にも支援が進行中であることが共有されます。メッセージで連携を続けてください。
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowStartProgressModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              キャンセル
            </button>
            <button onClick={handleStartProgress} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              支援を開始する
            </button>
          </div>
        </div>
      </Modal>

      {/* 解決報告確認モーダル */}
      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} title="解決を報告しますか？" type="info">
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-700">
              ✅ この相談の問題が解決したことを報告します。
            </p>
          </div>
          <p className="text-sm text-gray-500">
            報告後、相談者が確認することで案件が「解決済み」になります。
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowResolveModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              キャンセル
            </button>
            <button onClick={handleReportResolution} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              解決を報告する
            </button>
          </div>
        </div>
      </Modal>

      <toast.ToastContainer />
    </div>
  );
}