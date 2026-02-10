'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CaseData = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  intake_qna: {
    qa: Record<string, string>;
  };
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
};

// SDGsゴールの色定義
const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d',
  5: '#ff3a21', 6: '#26bde2', 7: '#fcc30b', 8: '#a21942',
  9: '#fd6925', 10: '#dd1367', 11: '#fd9d24', 12: '#bf8b2e',
  13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 16: '#00689d',
  17: '#19486a',
};

// SDGsゴールの名前
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
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCase = async () => {
      // ログイン確認
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // ケースデータ取得
      const { data, error: fetchError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', params.id)
        .single();

      if (fetchError || !data) {
        setError('相談内容が見つかりませんでした');
        setIsLoading(false);
        return;
      }

      setCaseData(data);
      setIsLoading(false);
    };

    loadCase();
  }, [params.id, router]);

  const handleAnalyze = async () => {
    if (!caseData) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // APIが期待する形式に変換
      const consultationText = [
        caseData.description_free,
        ...Object.values(caseData.intake_qna.qa)
      ].join(' ');

      const response = await fetch('/api/classify-sdgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationText }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'APIエラー');
      }

      const result = await response.json();

      // AI結果をDBに保存
      await supabase
        .from('cases')
        .update({ ai_sdg_suggestion: result.data })
        .eq('id', caseData.id);

      setCaseData(prev => prev
        ? { ...prev, ai_sdg_suggestion: result.data }
        : null
      );

    } catch (err) {
      console.error('Analysis error:', err);
      setError(`AI分析エラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setIsAnalyzing(false);
    }
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
        {/* 完了メッセージ */}
        <div className="mb-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-2xl font-bold text-gray-800">
            相談を受け付けました
          </h1>
          <p className="text-gray-500 mt-1">
            内容を確認し、AIが支援組織をマッチングします
          </p>
        </div>

        {/* 相談内容の確認 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">📋 相談内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">タイトル</p>
              <p className="font-medium">{caseData?.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">詳細</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {caseData?.description_free}
              </p>
            </div>
            <div className="flex gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${caseData?.urgency === 'High'
                ? 'bg-red-100 text-red-600'
                : 'bg-yellow-100 text-yellow-600'
                }`}>
                {caseData?.urgency === 'High' ? '⚠️ 緊急' : '📋 通常'}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                {caseData?.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* AI分析結果 */}
        {caseData?.ai_sdg_suggestion ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">🤖 AI分析結果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* 理由 */}
              <p className="text-sm text-gray-700">
                {caseData.ai_sdg_suggestion.reasoning}
              </p>

              {/* キーワード */}
              <div className="flex flex-wrap gap-2">
                {caseData.ai_sdg_suggestion.keywords?.map((kw, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600"
                  >
                    #{kw}
                  </span>
                ))}
              </div>

              {/* SDGsゴール */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">
                  関連するSDGsゴール
                </p>
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

            </CardContent>
          </Card>
        ) : (
          /* AI分析ボタン */
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-green-50 border-none">
            <CardContent className="py-6 text-center">
              <p className="text-gray-600 mb-4">
                AIがあなたの相談を分析して、<br />
                SDGsゴールと支援組織をマッチングします
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                {isAnalyzing ? '🤖 AI分析中...' : '🤖 AI分析を開始する'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* エラーメッセージ */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push('/dashboard/sos')}
          >
            ダッシュボードへ
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push('/sos/hearing')}
          >
            別の相談を投稿
          </Button>
        </div>
      </main>
    </div>
  );
}
