'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Q&A選択肢の定義
const QA_QUESTIONS = [
  {
    id: 1,
    question: '生活に必要なものが不足していますか？',
    options: [
      { id: 'q1_1', text: '食べるものが足りない' },
      { id: 'q1_2', text: '住む場所がない・不安定' },
      { id: 'q1_3', text: 'お金が足りない' },
      { id: 'q1_4', text: 'インターネットが使えない' },
      { id: 'q1_5', text: '特にない' },
    ],
  },
  {
    id: 2,
    question: '人間関係や権利について困っていますか？',
    options: [
      { id: 'q2_1', text: '家族との関係が辛い' },
      { id: 'q2_2', text: '差別・いじめを受けている' },
      { id: 'q2_3', text: '暴力・虐待を受けている' },
      { id: 'q2_4', text: '法的なトラブルがある' },
      { id: 'q2_5', text: '特にない' },
    ],
  },
  {
    id: 3,
    question: '仕事や将来について困っていますか？',
    options: [
      { id: 'q3_1', text: '仕事がない・失った' },
      { id: 'q3_2', text: '収入が少なすぎる' },
      { id: 'q3_3', text: '学校に行けない・行きたくない' },
      { id: 'q3_4', text: '将来が不安' },
      { id: 'q3_5', text: '特にない' },
    ],
  },
  {
    id: 4,
    question: '健康や心について困っていますか？',
    options: [
      { id: 'q4_1', text: '体の調子が悪い・病院に行けない' },
      { id: 'q4_2', text: '気持ちが落ち込んでいる' },
      { id: 'q4_3', text: '死にたいと思うことがある' },
      { id: 'q4_4', text: '介護・育児で疲れている' },
      { id: 'q4_5', text: '特にない' },
    ],
  },
  {
    id: 5,
    question: 'どんな支援を求めていますか？',
    options: [
      { id: 'q5_1', text: '公的な支援制度を知りたい' },
      { id: 'q5_2', text: '専門家（弁護士・医師等）に相談したい' },
      { id: 'q5_3', text: 'NPOや支援団体につながりたい' },
      { id: 'q5_4', text: '話を聞いてほしいだけ' },
      { id: 'q5_5', text: 'わからない' },
    ],
  },
];

export default function SOSHearingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 選択された回答
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});

  // 自由記述
  const [freeText, setFreeText] = useState({
    what: '',   // 何が起きているか
    when: '',   // いつから
    want: '',   // どうなってほしいか
  });

  // ログイン確認
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  // 選択肢の変更
  const handleAnswerChange = (questionId: number, optionText: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionText,
    }));
  };

  // 緊急ワード検知
  const detectUrgency = (text: string): boolean => {
    const urgentWords = ['死にたい', '殺される', '消えたい', '限界', '助けて', '虐待', '暴力'];
    return urgentWords.some(word => text.includes(word));
  };

  const handleSubmit = async () => {
    setError(null);

    // 全設問に回答しているか確認
    const unanswered = QA_QUESTIONS.filter(q => !selectedAnswers[q.id]);
    if (unanswered.length > 0) {
      setError('すべての質問に答えてください');
      return;
    }

    // 自由記述の確認
    if (!freeText.what.trim()) {
      setError('「何が起きているか」を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      // 緊急度判定
      const allText = Object.values(selectedAnswers).join(' ') + ' ' +
        Object.values(freeText).join(' ');
      const isUrgent = detectUrgency(allText) ||
        selectedAnswers[4] === '死にたいと思うことがある';

      // セッション取得
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
        setIsSubmitting(false);
        return;
      }

      // cases テーブルに保存
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert([{
          owner_user_id: userData.id,
          intake_qna: {
            qa: selectedAnswers,
          },
          description_free: [
            freeText.what,
            freeText.when,
            freeText.want
          ].filter(Boolean).join('\n'),
          title: freeText.what.slice(0, 50) || '相談',
          urgency: isUrgent ? 'High' : 'Medium',
          status: 'OPEN',
          region_country: 'ID',
        }])
        .select()
        .single();

      if (caseError) {
        console.error('Case error:', caseError);
        setError(`保存エラー: ${caseError.message}`);
        setIsSubmitting(false);
        return;
      }

      // 緊急の場合は警告表示
      if (isUrgent) {
        alert('⚠️ あなたのことが心配です。\n今すぐ話を聞いてもらえる場所があります。\n\nよりそいホットライン: 0120-279-338（24時間）');
      }

      // AI分析ページへ（次のステップで実装）
      router.push(`/sos/result/${caseData.id}`);

    } catch (err) {
      console.error('Submit error:', err);
      setError('送信中にエラーが発生しました');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            相談フォーム
          </h1>
          <p className="text-gray-500 mt-1">
            あなたの状況を教えてください。AIが最適な支援につなぎます。
          </p>
        </div>

        <div className="space-y-6">
          {/* Q&Aフォーム */}
          {QA_QUESTIONS.map((question) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Q{question.id}. {question.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAnswers[question.id] === option.text
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50 border-gray-200'
                        }`}
                    >
                      <input
                        type="radio"
                        name={`question_${question.id}`}
                        value={option.text}
                        checked={selectedAnswers[question.id] === option.text}
                        onChange={() => handleAnswerChange(question.id, option.text)}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{option.text}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* 自由記述 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                もう少し詳しく教えてください
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="what">
                  いま何が起きていますか？ <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="what"
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="例：親に内緒でバイト、学校に行けない、来月の家賃が払えない"
                  value={freeText.what}
                  onChange={(e) => setFreeText({ ...freeText, what: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="when">いつから困っていますか？</Label>
                <textarea
                  id="when"
                  rows={2}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="例：3ヶ月前から、去年の春から"
                  value={freeText.when}
                  onChange={(e) => setFreeText({ ...freeText, when: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="want">どうなってほしいですか？</Label>
                <textarea
                  id="want"
                  rows={2}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="例：一人で静かに過ごせる場所がほしい、仕事を見つけたい"
                  value={freeText.want}
                  onChange={(e) => setFreeText({ ...freeText, want: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* エラーメッセージ */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* 送信ボタン */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 py-6 text-base"
          >
            {isSubmitting ? '送信中...' : '相談内容を送信する'}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            ※入力内容はAI分析のみに使用され、支援組織とのマッチングに活用されます
          </p>
        </div>
      </main>
    </div>
  );
}
