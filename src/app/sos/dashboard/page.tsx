'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
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
  intake_qna: {
    qa: Record<string, string>;
  };
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
  owner_user_id: string;
  owner?: {
    display_name: string;
    real_name: string;
  };
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
  const [isLoading, setIsLoading] = useState(true);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select(`
        *,
        owner:users!cases_owner_user_id_fkey ( display_name, real_name )
      `)
      .eq('id', params.id)
      .single();

    if (caseError || !caseData) {
      toast.error('相談が見つかりませんでした');
      router.push('/supporter/dashboard');
      return;
    }

    setCaseData(caseData);

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (!userData) {
      setIsLoading(false);
      return;
    }

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
    if (!offerMessage.trim()) {
      toast.warning('メッセージを入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!userData) {
        toast.error('ユーザー情報が取得できませんでした');
        setIsSubmitting(false);
        return;
      }

      // 🆕 既存のオファーがあるか確認
      if (myOffer && (myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED')) {
        // 既存レコードを更新（再申し出）
        const { error } = await supabase
          .from('offers')
          .update({
            message: offerMessage,
            status: 'PENDING',
            created_at: new Date().toISOString(),
          })
          .eq('id', myOffer.id);

        if (error) {
          console.error('Update offer error:', error);
          toast.error('申し出の更新に失敗しました');
          setIsSubmitting(false);
          return;
        }
      } else {
        // 新規作成
        const { error } = await supabase
          .from('offers')
          .insert([{
            case_id: params.id,
            supporter_user_id: userData.id,
            message: offerMessage,
            status: 'PENDING',
          }]);

        if (error) {
          console.error('Insert offer error:', error);
          if (error.code === '23505') {
            toast.error('既に申し出を送信済みです');
          } else {
            toast.error('申し出の送信に失敗しました');
          }
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

    console.log('🔄 Withdrawing offer:', myOffer.id);

    const { data, error } = await supabase
      .from('offers')
      .update({
        status: 'WITHDRAWN',
        // updated_atは削除（トリガーで自動更新されるため）
      })
      .eq('id', myOffer.id)
      .select(); // 🆕 結果を取得

    console.log('📊 Withdraw result:', { data, error });

    if (error) {
      console.error('❌ Withdraw error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      toast.error('取り下げに失敗しました: ' + error.message);
      return;
    }

    setShowWithdrawModal(false);
    await loadData();
    toast.success('申し出を取り下げました');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 🆕 オファーを送信できるか判定
  const canSendOffer = !myOffer || myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED';
  // 🆕 オファーを表示すべきか判定
  const shouldShowOffer = myOffer && myOffer.status !== 'WITHDRAWN' && myOffer.status !== 'DECLINED';

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
        <Button
          variant="outline"
          onClick={() => router.push('/supporter/dashboard')}
          className="mb-4"
        >
          ← ダッシュボードに戻る
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{caseData?.title}</CardTitle>
                {/* 相談者情報 */}
                {caseData?.owner && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">
                      👤 相談者: {caseData.owner.display_name}
                    </span>
                    {myOffer?.status === 'ACCEPTED' && caseData.owner.real_name && (
                      <span className="ml-2 text-sm text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        本名: {caseData.owner.real_name}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {caseData?.urgency === 'High' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">
                      ⚠️ 緊急
                    </span>
                  )}
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                    {caseData?.status}
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
              <p className="text-gray-700 whitespace-pre-line">
                {caseData?.description_free}
              </p>
            </div>

            {caseData?.ai_sdg_suggestion && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3">🤖 AI分析結果</h3>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">関連するSDGsゴール</p>
                  <div className="flex flex-wrap gap-2">
                    {caseData.ai_sdg_suggestion.sdgs_goals?.map((goalId) => (
                      <div
                        key={goalId}
                        className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ backgroundColor: `${SDG_COLORS[goalId]}20` }}
                      >
                        <span
                          className="text-white text-xs font-bold px-2 py-1 rounded"
                          style={{ backgroundColor: SDG_COLORS[goalId] }}
                        >
                          SDG {goalId}
                        </span>
                        <span className="text-sm font-medium">
                          {SDG_NAMES[goalId]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {caseData.ai_sdg_suggestion.keywords && (
                  <div className="flex flex-wrap gap-2">
                    {caseData.ai_sdg_suggestion.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 🆕 オファー表示ロジック改善 */}
        {shouldShowOffer && myOffer ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">あなたの申し出状況</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${myOffer.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : myOffer.status === 'ACCEPTED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}>
                    {myOffer.status === 'PENDING' && '⏳ 承認待ち'}
                    {myOffer.status === 'ACCEPTED' && '✅ 承認済み'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(myOffer.created_at)}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">{myOffer.message}</p>
                </div>

                {myOffer.status === 'PENDING' && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowWithdrawModal(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      申し出を取り下げる
                    </Button>
                  </div>
                )}

                {myOffer.status === 'ACCEPTED' && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 mb-2">
                      💚 相談者があなたの支援を承認しました。
                    </p>
                    <Button
                      onClick={() => router.push(`/messages/${myOffer.id}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      💬 メッセージを送る
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : canSendOffer ? (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-green-50 border-none">
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                この方を支援しませんか？
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {myOffer && (myOffer.status === 'WITHDRAWN' || myOffer.status === 'DECLINED')
                  ? '再度申し出を送信できます'
                  : 'あなたの組織で支援できる場合は、申し出を送信してください'}
              </p>
              <Button
                onClick={() => setShowOfferModal(true)}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                💙 支援を申し出る
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </main>

      {/* オファー送信モーダル */}
      <Modal
        isOpen={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        title="支援の申し出"
        type="info"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            この方への支援について、メッセージを送信してください。
          </p>

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
            <button
              onClick={() => setShowOfferModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmitOffer}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? '送信中...' : '送信する'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 🆕 取り下げ確認モーダル */}
      <Modal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="申し出を取り下げますか？"
        type="warning"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            この申し出を取り下げると、相談者には表示されなくなります。
          </p>
          <p className="text-sm text-gray-500">
            ※ 取り下げ後、再度申し出を送ることができます
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={confirmWithdraw}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              取り下げる
            </button>
          </div>
        </div>
      </Modal>

      <toast.ToastContainer />
    </div>
  );
}