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
import { SUPPORTER_BADGES, SELECTABLE_BADGES, BadgeKey } from '@/lib/constants/sdgs';

type CaseData = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  created_at: string;
  supporter_resolved_at: string | null;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning?: string;
    summary?: string;
    per_goal?: Array<{
      goal: number;
      title: string;
      explanation: string;
    }>;
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
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [limitModal, setLimitModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferData | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [selectedBadges, setSelectedBadges] = useState<Set<BadgeKey>>(new Set());
  const [isSubmittingBadges, setIsSubmittingBadges] = useState(false);
  const [supporterBadges, setSupporterBadges] = useState<Record<string, Record<string, number>>>({});

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

    // サポーターの全バッジを取得（全案件の累計）
    const supporterIds = offersWithSupporter.map((o: OfferData) => o.supporter.id);

    if (supporterIds.length > 0) {
      const { data: badgeData } = await supabase
        .from('supporter_badges')
        .select('supporter_user_id, badge_key')
        .in('supporter_user_id', supporterIds);

      if (badgeData) {
        const badgeMap: Record<string, Record<string, number>> = {};
        badgeData.forEach((b: { supporter_user_id: string; badge_key: string }) => {
          if (!badgeMap[b.supporter_user_id]) badgeMap[b.supporter_user_id] = {};
          badgeMap[b.supporter_user_id][b.badge_key] = (badgeMap[b.supporter_user_id][b.badge_key] || 0) + 1;
        });
        setSupporterBadges(badgeMap);
      }
    }
  };

  const runAIAnalysis = async (cd: CaseData) => {
    setIsAnalyzing(true);
    setAnalyzeStep(1); // 受付完了

    // ステップ進行タイマー
    const step2 = setTimeout(() => setAnalyzeStep(2), 1500);
    const step3 = setTimeout(() => setAnalyzeStep(3), 4000);

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: cd.id, description: cd.description_free }),
      });
      if (!response.ok) { toast.error('AI分析に失敗しました'); return; }
      const result = await response.json();

      clearTimeout(step2);
      clearTimeout(step3);
      setAnalyzeStep(4); // 完了

      const { error: updateError } = await supabase
        .from('cases')
        .update({ ai_sdg_suggestion: result.analysis, visibility: 'LISTED' })
        .eq('id', cd.id);
      if (!updateError) {
        // 少し間を置いてから結果表示（完了ステップを見せる）
        await new Promise(r => setTimeout(r, 800));
        setCaseData({ ...cd, ai_sdg_suggestion: result.analysis });
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error('AI分析に失敗しました');
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep(0);
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

  // IN_PROGRESS → RESOLVED: 解決済みにする（SOS側のアクション）
  const handleResolveCase = async () => {
    const { error } = await supabase
      .from('cases')
      .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) { toast.error('ステータスの更新に失敗しました'); return; }
    setShowResolveModal(false);
    await loadData();

    // 金メダルを自動付与してから評価モーダルを表示
    const accepted = offers.filter(o => o.status === 'ACCEPTED');
    if (accepted.length > 0 && currentUserId) {
      const autoBadges = accepted.map((offer, i) => ({
        case_id: params.id as string,
        supporter_user_id: offer.supporter.id,
        given_by_user_id: currentUserId,
        badge_key: i === 0 ? 'gold_medal' : 'silver_medal',
      }));
      await supabase.from('supporter_badges').upsert(autoBadges, {
        onConflict: 'case_id,supporter_user_id,badge_key',
      });
    }

    setShowEvalModal(true);
  };

  // SOS側: サポーターの解決報告を拒否 → IN_PROGRESSに戻す
  const handleRejectResolution = async () => {
    const { error } = await supabase
      .from('cases')
      .update({ supporter_resolved_at: null })
      .eq('id', params.id);
    if (error) {
      toast.error('ステータスの更新に失敗しました');
      return;
    }
    toast.success('サポーターに対応継続を依頼しました');
    await loadData();
  };

  // 評価バッジを送信
  const handleSubmitBadges = async () => {
    const accepted = offers.filter(o => o.status === 'ACCEPTED');
    if (accepted.length === 0 || !currentUserId) return;

    setIsSubmittingBadges(true);
    const badgeRows = accepted.flatMap((offer) =>
      [...selectedBadges].map((badgeKey) => ({
        case_id: params.id as string,
        supporter_user_id: offer.supporter.id,
        given_by_user_id: currentUserId,
        badge_key: badgeKey,
      }))
    );

    if (badgeRows.length > 0) {
      const { error } = await supabase.from('supporter_badges').upsert(badgeRows, {
        onConflict: 'case_id,supporter_user_id,badge_key',
      });
      if (error) { toast.error('評価の送信に失敗しました'); setIsSubmittingBadges(false); return; }
    }

    setIsSubmittingBadges(false);
    setShowEvalModal(false);
    toast.success('サポーターへの評価を送信しました！ありがとうございます 🎉');
  };

  // バッジ選択のトグル
  const toggleBadge = (key: BadgeKey) => {
    setSelectedBadges(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center space-y-6">
          {/* AIアイコンアニメーション */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-20" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-green-400 opacity-10 animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center">
              <span className="text-3xl animate-bounce">🤖</span>
            </div>
          </div>

          {/* テキスト */}
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">AIがあなたの相談を準備中です</p>
            <div className="flex justify-center gap-1">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>

          <p className="text-xs text-gray-400">少々お待ちください</p>
        </div>
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

        {/* AI分析 — ステップアニメーション */}
        {isAnalyzing && (
          <Card className="mb-6 overflow-hidden">
            <CardContent className="py-8">
              <div className="max-w-md mx-auto space-y-4">
                {[
                  { step: 1, icon: '📨', text: '相談内容を受け付けました' },
                  { step: 2, icon: '🔍', text: 'AIがあなたの状況を分析しています...' },
                  { step: 3, icon: '🌍', text: '関連するSDGsゴールを特定中...' },
                  { step: 4, icon: '✨', text: '分析が完了しました！' },
                ].map((s) => {
                  const isActive = analyzeStep >= s.step;
                  const isCurrent = analyzeStep === s.step && s.step < 4;
                  return (
                    <div
                      key={s.step}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                        } ${s.step === 4 ? 'bg-green-50 border border-green-200' : ''}`}
                    >
                      {isActive && !isCurrent ? (
                        <span className="text-green-500 text-lg flex-shrink-0">✅</span>
                      ) : isCurrent ? (
                        <span className="text-lg flex-shrink-0 animate-pulse">{s.icon}</span>
                      ) : (
                        <span className="text-gray-300 text-lg flex-shrink-0">○</span>
                      )}
                      <span className={`text-sm ${isActive ? (s.step === 4 ? 'text-green-700 font-medium' : 'text-gray-700') : 'text-gray-300'}`}>
                        {s.text}
                      </span>
                      {isCurrent && (
                        <div className="ml-auto flex gap-1">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* プログレスバー */}
              <div className="mt-6 mx-auto max-w-md">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(analyzeStep * 25, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI分析結果 — カード型表示 */}
        {!isAnalyzing && caseData?.ai_sdg_suggestion ? (
          <div className="mb-6 space-y-4">
            {/* ヘッダー */}
            <div className="text-center py-2">
              <h2 className="text-lg font-bold text-gray-800">🌍 あなたの声と世界のつながり</h2>
              <p className="text-xs text-gray-500 mt-1">あなたの相談がSDGs（持続可能な開発目標）のどの課題に関わるかをAIが分析しました</p>
            </div>

            {/* サマリーメッセージ */}
            {(caseData.ai_sdg_suggestion.summary || caseData.ai_sdg_suggestion.reasoning) && (
              <Card className="border-none bg-gradient-to-br from-blue-50 to-green-50 shadow-sm">
                <CardContent className="py-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {caseData.ai_sdg_suggestion.summary || caseData.ai_sdg_suggestion.reasoning}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ゴール別カード */}
            {caseData.ai_sdg_suggestion.per_goal && caseData.ai_sdg_suggestion.per_goal.length > 0 ? (
              <div className="space-y-3">
                {caseData.ai_sdg_suggestion.per_goal.map((pg, idx) => (
                  <Card key={pg.goal} className="border-none shadow-sm overflow-hidden">
                    <div className="flex">
                      {/* SDGカラーバー */}
                      <div
                        className="w-2 flex-shrink-0"
                        style={{ backgroundColor: SDG_COLORS[pg.goal] || '#888' }}
                      />
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-white text-[11px] font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: SDG_COLORS[pg.goal] || '#888' }}
                          >
                            SDG {pg.goal}
                          </span>
                          <span className="text-xs text-gray-500">{SDG_NAMES[pg.goal]}</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-1.5">{pg.title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{pg.explanation}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              /* per_goal が無い旧データの場合はフォールバック */
              <div className="space-y-3">
                {caseData.ai_sdg_suggestion.sdgs_goals?.map((goalId) => (
                  <Card key={goalId} className="border-none shadow-sm overflow-hidden">
                    <div className="flex">
                      <div className="w-2 flex-shrink-0" style={{ backgroundColor: SDG_COLORS[goalId] }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-[11px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: SDG_COLORS[goalId] }}>
                            SDG {goalId}
                          </span>
                          <span className="text-sm font-medium">{SDG_NAMES[goalId]}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* キーワード */}
            {caseData.ai_sdg_suggestion.keywords && caseData.ai_sdg_suggestion.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {caseData.ai_sdg_suggestion.keywords.map((kw, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-full text-gray-600 shadow-sm">
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* ───── 承認済みサポーター + メッセージ ───── */}
        {hasAccepted && (
          <div className="mb-6 space-y-4">
            {/* ステータス進行バー */}
            <Card className="border-none bg-white shadow-sm">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">📊 進行状況</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${caseData?.status === 'IN_PROGRESS' && caseData?.supporter_resolved_at
                      ? 'bg-emerald-100 text-emerald-600' :
                      caseData?.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' :
                        caseData?.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-600' :
                          caseData?.status === 'RESOLVED' ? 'bg-green-100 text-green-600' :
                            'bg-blue-100 text-blue-600'
                    }`}>
                    {caseData?.status === 'MATCHED' && '🤝 マッチ済み'}
                    {caseData?.status === 'IN_PROGRESS' && !caseData?.supporter_resolved_at && '🔄 対応中'}
                    {caseData?.status === 'IN_PROGRESS' && caseData?.supporter_resolved_at && '📋 解決報告あり'}
                    {caseData?.status === 'RESOLVED' && '✅ 解決済み'}
                    {caseData?.status === 'OPEN' && '⏳ サポーター待ち'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {['マッチ', '対応中', '解決報告', '完了'].map((step, i) => {
                    const stepNum = i + 1;
                    const currentStep =
                      caseData?.status === 'MATCHED' ? 1 :
                        caseData?.status === 'IN_PROGRESS' && !caseData?.supporter_resolved_at ? 2 :
                          caseData?.status === 'IN_PROGRESS' && caseData?.supporter_resolved_at ? 3 :
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

                {/* アクションボタン（SOS側） */}
                <div className="mt-4">
                  {caseData?.status === 'MATCHED' && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                      <p className="text-sm text-amber-700">
                        ⏳ サポーターが支援を開始するのをお待ちください
                      </p>
                    </div>
                  )}
                  {caseData?.status === 'IN_PROGRESS' && !caseData?.supporter_resolved_at && (
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-center">
                      <p className="text-sm text-purple-700">
                        🔄 サポーターが対応中です
                      </p>
                    </div>
                  )}
                  {caseData?.status === 'IN_PROGRESS' && caseData?.supporter_resolved_at && (
                    <div className="space-y-3">
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
                        <p className="text-sm text-emerald-700 font-medium">
                          📋 サポーターが解決を報告しました
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          問題が解決していれば、下のボタンで確認してください
                        </p>
                        {caseData?.supporter_resolved_at && (() => {
                          const deadline = new Date(new Date(caseData.supporter_resolved_at).getTime() + 14 * 24 * 60 * 60 * 1000);
                          const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                          return (
                            <p className="text-[11px] text-gray-400 mt-2">
                              ⏰ 未確認の場合、{daysLeft}日後に自動で解決済みになります
                            </p>
                          );
                        })()}
                      </div>
                      <Button
                        onClick={() => setShowResolveModal(true)}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                      >
                        ✅ 解決を確認する
                      </Button>
                      <Button
                        onClick={handleRejectResolution}
                        variant="outline"
                        className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                      >
                        ❌ まだ解決していない
                      </Button>
                    </div>
                  )}
                  {caseData?.status === 'RESOLVED' && (
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                      <p className="text-sm text-green-700 font-medium">
                        ✅ この相談は解決済みです
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-base text-green-800">
                  ✅ 承認済みのサポーター ({acceptedOffers.length}名)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {acceptedOffers.map((offer) => {
                  const badges = supporterBadges[offer.supporter.id] || {};
                  return (
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
                      {/* バッジ表示 */}
                      {badges && Object.keys(badges).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-green-100">
                          <p className="text-[11px] text-gray-400 mb-1.5">🎁 感謝バッジ（全案件の累計）</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(badges).map(([bk, count]) => {
                              const b = SUPPORTER_BADGES[bk as BadgeKey];
                              if (!b) return null;
                              return (
                                <span
                                  key={bk}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 border border-amber-200 rounded-full"
                                  title={b.label}
                                >
                                  <span>{b.emoji}</span>
                                  <span className="text-amber-700">{b.label}</span>
                                  {count > 1 && <span className="text-amber-500 font-medium">×{count}</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 💬 メッセージスレッド */}
            {currentUserId && (
              <MessageThread
                caseId={caseData!.id}
                currentUserId={currentUserId}
                readOnly={caseData?.status === 'RESOLVED' || caseData?.status === 'CLOSED' || caseData?.status === 'CANCELLED'}
              />
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
              {pendingOffers.map((offer) => {
                const badges = supporterBadges[offer.supporter.id] || {};
                const badgeEntries = Object.entries(badges);
                return (
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
                    {/* バッジ実績 */}
                    {badgeEntries.length > 0 && (
                      <div className="mb-3 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                        <p className="text-[11px] text-amber-600 mb-1.5">🏆 これまでの評価</p>
                        <div className="flex flex-wrap gap-1.5">
                          {badgeEntries.map(([bk, count]) => {
                            const b = SUPPORTER_BADGES[bk as BadgeKey];
                            if (!b) return null;
                            return (
                              <span key={bk} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-white border border-amber-200 rounded-full">
                                <span>{b.emoji}</span>
                                <span className="text-amber-700">{b.label}</span>
                                {count > 1 && <span className="text-amber-500 font-medium">×{count}</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                );
              })}
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

      {/* 解決確認モーダル */}
      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} title="解決を確認しますか？" type="info">
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-700">
              ✅ サポーターが解決を報告しています。問題が解決したことを確認します。
            </p>
          </div>
          <p className="text-sm text-gray-500">
            確認後、案件は「解決済み」になります。これまでのメッセージ履歴は引き続き閲覧できます。
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowResolveModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              まだ解決していない
            </button>
            <button onClick={handleResolveCase} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              解決を確認する
            </button>
          </div>
        </div>
      </Modal>

      {/* 評価モーダル（解決確認後に必須表示） */}
      <Modal isOpen={showEvalModal} onClose={() => { }} title="🎉 サポーターを評価" type="info">
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-5xl mb-2">🎊</div>
            <p className="text-sm text-gray-600">
              相談が解決しました！サポーターに感謝のバッジを贈りましょう。
            </p>
          </div>

          {/* 自動付与バッジ */}
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-600 font-medium mb-2">🏅 自動付与</p>
            <div className="flex gap-3 flex-wrap">
              {offers.filter(o => o.status === 'ACCEPTED').map((offer, i) => (
                <div key={offer.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-amber-200">
                  <span className="text-lg">{i === 0 ? '🥇' : '🥈'}</span>
                  <span className="text-xs text-gray-700">{offer.supporter.organization_name || offer.supporter.display_name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 選択バッジ */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-3">✨ 追加バッジを選択してください（複数可）</p>
            <div className="grid grid-cols-1 gap-2">
              {SELECTABLE_BADGES.map((key) => {
                const badge = SUPPORTER_BADGES[key];
                const isSelected = selectedBadges.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleBadge(key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isSelected
                        ? 'border-blue-400 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <span className="text-2xl">{badge.emoji}</span>
                    <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                      {badge.label}
                    </span>
                    {isSelected && (
                      <span className="ml-auto text-blue-500 text-lg">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSubmitBadges}
            disabled={isSubmittingBadges || selectedBadges.size === 0}
            className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 text-sm font-medium disabled:opacity-50"
          >
            {isSubmittingBadges ? '送信中...' : `🎁 バッジを贈る (${selectedBadges.size})`}
          </button>
          {selectedBadges.size === 0 && (
            <p className="text-xs text-center text-gray-400">※ 1つ以上のバッジを選択してください</p>
          )}
        </div>
      </Modal>

      <toast.ToastContainer />
    </div>
  );
}