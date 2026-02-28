// ─────────────────────────────────────────────────────────────
// 📂 src/app/sos/hearing/page.tsx
// SOS相談フォーム（ヒアリング）
// ─────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';

// ─── 文字数制限 ──────────────────────────────────────────────
const CHAR_LIMITS = {
  otherText: 200,
  what: 1000,
  when: 200,
  want: 200,
};

// ─── Q&A選択肢の定義 ────────────────────────────────────────
const QA_QUESTIONS = [
  {
    id: 1,
    question: '生活に必要なものが不足していますか？',
    options: [
      { id: 'q1_1', text: '飲食物が足りていない/買うお金がない' },
      { id: 'q1_2', text: '住む場所がない/不安定/無くなりそう/奪われそう' },
      { id: 'q1_3', text: 'トイレがない/野外で排泄しなければならない環境にある' },
      { id: 'q1_4', text: '電気/インターネットが使えない' },
      { id: 'q1_5', text: '出生登録がないため身分証明ができない' },
    ],
    otherPlaceholder: '例：清潔な飲み水が手に入らない、冬に暖房がない',
  },
  {
    id: 2,
    question: '人間関係や権利について困っていますか？',
    options: [
      { id: 'q2_1', text: '戦争・紛争・内乱に巻き込まれている' },
      { id: 'q2_2', text: '差別(性別/障害/国籍など)・ハラスメント(身体的/性的)・いじめ・嫌がらせを受けている' },
      { id: 'q2_3', text: '暴力(身体的/精神的/性的)・児童虐待を受けている' },
      { id: 'q2_4', text: '人身取引の被害にあっている' },
      { id: 'q2_5', text: '希望しない結婚/婚姻(未成年/強制)をさせられた/させられようとしている' },
    ],
    otherPlaceholder: '例：宗教的な理由で自由を奪われている、難民として差別を受けている',
  },
  {
    id: 3,
    question: '仕事や将来について困っていますか？',
    options: [
      { id: 'q3_1', text: '仕事がなく職業訓練も受けていない' },
      { id: 'q3_2', text: '最低限の生活をするにも収入が少なすぎてできない' },
      { id: 'q3_3', text: '学校へ行けない' },
      { id: 'q3_4', text: '未成年だが働かされている' },
      { id: 'q3_5', text: '銀行口座を持っていない' },
    ],
    otherPlaceholder: '例：障害があり就職活動ができない、借金を返すために働き続けている',
  },
  {
    id: 4,
    question: '健康や心について困っていますか？',
    options: [
      { id: 'q4_1', text: '体の調子が悪いが金銭面などの理由から病院に行けない' },
      { id: 'q4_2', text: 'HIV/結核/マラリア/B型肝炎/心血管疾患/糖尿病/慢性の呼吸器疾患/デング熱など顧みられない熱帯病/貧血を患っている' },
      { id: 'q4_3', text: '死にたいと思ったことがある' },
      { id: 'q4_4', text: '煙(調理のための裸火/たばこの受動喫煙)を吸わなければならない環境である' },
      { id: 'q4_5', text: '新生児/5歳未満児が生命の危機に瀕している' },
    ],
    otherPlaceholder: '例：精神的なケアが必要だが相談先がわからない、薬が手に入らない',
  },
  {
    id: 5,
    question: 'どんな支援を求めていますか？',
    options: [
      { id: 'q5_1', text: '公的な支援制度を知りたい' },
      { id: 'q5_2', text: '専門家（弁護士・医師等）に相談したい' },
      { id: 'q5_3', text: 'NPOや支援団体につながりたい' },
      { id: 'q5_4', text: 'まずは相談に乗ってほしい' },
      { id: 'q5_5', text: '具体的にわからないがとにかく助けてほしい' },
    ],
    otherPlaceholder: '例：子どもの保護が必要、避難場所を探している',
  },
];

// ─── 文字数カウンター ────────────────────────────────────────
function CharCounter({ current, max }: { current: number; max: number }) {
  return (
    <div className={`text-right text-[11px] mt-1 ${current > max ? 'text-red-500 font-medium' : current > max * 0.8 ? 'text-amber-500' : 'text-gray-400'}`}>
      {current} / {max}
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────────
export default function SOSHearingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // 選択された回答（複数選択可）
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, Set<string>>>({});

  // Q1〜Q5の「その他」チェック状態 & テキスト
  const [otherChecked, setOtherChecked] = useState<Record<number, boolean>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});

  // 自由記述
  const [freeText, setFreeText] = useState({ what: '', when: '', want: '' });

  // ログイン確認
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const roleRes = await fetch('/api/auth/get-role', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const roleData = await roleRes.json();
      if (!roleData.user) { router.push('/login'); return; }
      const casesRes = await fetch('/api/sos/cases', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const casesData = await casesRes.json();
      const userCases = (casesData.cases || []).filter((c: { status: string }) => c.status === 'OPEN');
      if ((userCases?.length || 0) >= 3) { setShowLimitModal(true); return; }

      setIsLoading(false);
    };
    checkAuth();
  }, [router]);

  // チェックボックスの変更
  const handleToggleOption = (questionId: number, optionText: string) => {
    setSelectedAnswers(prev => {
      const current = new Set(prev[questionId] || []);
      if (current.has(optionText)) current.delete(optionText);
      else current.add(optionText);
      return { ...prev, [questionId]: current };
    });
  };

  // 「その他」チェック切り替え
  const handleToggleOther = (questionId: number) => {
    setOtherChecked(prev => {
      const next = { ...prev, [questionId]: !prev[questionId] };
      if (!next[questionId]) setOtherTexts(p => ({ ...p, [questionId]: '' }));
      return next;
    });
  };

  // 緊急ワード検知
  const detectUrgency = (text: string): boolean => {
    const urgentWords = ['死にたい', '殺される', '消えたい', '限界', '助けて', '虐待', '暴力', '紛争', '戦争', '人身取引', 'suicide', 'kill', 'die', 'abuse', 'violence', 'war', 'trafficking'];
    return urgentWords.some(word => text.toLowerCase().includes(word.toLowerCase()));
  };

  const handleSubmit = async () => {
    setError(null);

    // バリデーション
    for (const q of QA_QUESTIONS) {
      const selected = selectedAnswers[q.id]?.size || 0;
      const hasOther = otherChecked[q.id] && otherTexts[q.id]?.trim();
      if (selected === 0 && !hasOther) {
        setError(`Q${q.id} に少なくとも1つ回答してください`);
        return;
      }
      if (otherChecked[q.id] && !otherTexts[q.id]?.trim()) {
        setError(`Q${q.id} の「その他」の内容を入力してください`);
        return;
      }
      if ((otherTexts[q.id]?.length || 0) > CHAR_LIMITS.otherText) {
        setError(`Q${q.id} の「その他」は${CHAR_LIMITS.otherText}文字以内で入力してください`);
        return;
      }
    }

    if (!freeText.what.trim()) {
      setError('「いま何が起きていますか？」を入力してください');
      return;
    }
    if (freeText.what.length > CHAR_LIMITS.what) {
      setError(`「いま何が起きていますか？」は${CHAR_LIMITS.what}文字以内で入力してください`);
      return;
    }

    setIsSubmitting(true);

    try {
      // 回答データ整形
      const qaData: Record<number, string[]> = {};
      for (const q of QA_QUESTIONS) {
        const items = [...(selectedAnswers[q.id] || [])];
        if (otherChecked[q.id] && otherTexts[q.id]?.trim()) {
          items.push(`その他: ${otherTexts[q.id].trim()}`);
        }
        qaData[q.id] = items;
      }

      // 緊急度判定
      const allText = Object.values(qaData).flat().join(' ') + ' ' + Object.values(freeText).join(' ') + ' ' + Object.values(otherTexts).join(' ');
      const isUrgent = detectUrgency(allText) || (selectedAnswers[4]?.has('死にたいと思ったことがある'));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const roleRes2 = await fetch('/api/auth/get-role', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const roleData2 = await roleRes2.json();
      if (!roleData2.user) { setError('ユーザー情報が取得できませんでした'); setIsSubmitting(false); return; }

      const caseRes = await fetch('/api/sos/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          intake_qna: { qa: qaData },
          description_free: [
            freeText.what,
            freeText.when ? `いつから: ${freeText.when}` : '',
            freeText.want ? `どうなりたい: ${freeText.want}` : '',
          ].filter(Boolean).join('\n'),
          title: freeText.what.slice(0, 50) || '相談',
          urgency: isUrgent ? 'High' : 'Medium',
          status: 'OPEN',
          region_country: 'ID',
        }),
      });
      const caseResult = await caseRes.json();
      if (!caseRes.ok) {
        console.error('Case error:', caseResult);
        setError(`保存エラー: ${caseResult.error}`);
        setIsSubmitting(false);
        return;
      }
      const caseData = caseResult.case;


      if (isUrgent) {
        alert('⚠️ あなたのことが心配です。\n今すぐ話を聞いてもらえる場所があります。\n\nよりそいホットライン: 0120-279-338（24時間）');
      }

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
          <h1 className="text-2xl font-bold text-gray-800">相談フォーム</h1>
          <p className="text-gray-500 mt-1">あなたの状況を教えてください。AIが最適な支援につなぎます。</p>
          <p className="text-xs text-gray-400 mt-2">※ 複数の項目に当てはまる場合はすべてチェックしてください</p>
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
                  {question.options.map((option) => {
                    const isChecked = selectedAnswers[question.id]?.has(option.text) || false;
                    return (
                      <label
                        key={option.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleOption(question.id, option.text)}
                          className="mt-0.5 text-blue-600 rounded"
                        />
                        <span className="text-sm leading-relaxed">{option.text}</span>
                      </label>
                    );
                  })}

                  {/* その他 */}
                  <div>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${otherChecked[question.id] ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={otherChecked[question.id] || false}
                        onChange={() => handleToggleOther(question.id)}
                        className="mt-0.5 text-blue-600 rounded"
                      />
                      <span className="text-sm">その他</span>
                    </label>

                    {otherChecked[question.id] && (
                      <div className="mt-2 ml-8">
                        <textarea
                          rows={2}
                          maxLength={CHAR_LIMITS.otherText}
                          className="w-full p-3 border border-blue-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                          placeholder={question.otherPlaceholder}
                          value={otherTexts[question.id] || ''}
                          onChange={(e) => setOtherTexts(prev => ({ ...prev, [question.id]: e.target.value }))}
                        />
                        <CharCounter current={otherTexts[question.id]?.length || 0} max={CHAR_LIMITS.otherText} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* 自由記述 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">もう少し詳しく教えてください</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="what">
                  いま何が起きていますか？ <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-400 mb-1">
                  できるだけ詳細に記載すると支援者が見つかりやすくなります
                </p>
                <textarea
                  id="what"
                  rows={4}
                  maxLength={CHAR_LIMITS.what}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="例：親が新興宗教の信者で病院への受診を拒否されている。1週間前から高熱が続いているが医療を受けられない。"
                  value={freeText.what}
                  onChange={(e) => setFreeText({ ...freeText, what: e.target.value })}
                />
                <CharCounter current={freeText.what.length} max={CHAR_LIMITS.what} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="when">いつから困っていますか？</Label>
                <textarea
                  id="when"
                  rows={2}
                  maxLength={CHAR_LIMITS.when}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="例：3ヶ月前から、去年の春から"
                  value={freeText.when}
                  onChange={(e) => setFreeText({ ...freeText, when: e.target.value })}
                />
                <CharCounter current={freeText.when.length} max={CHAR_LIMITS.when} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="want">どうなりたいですか？</Label>
                <textarea
                  id="want"
                  rows={2}
                  maxLength={CHAR_LIMITS.want}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="例：安全な場所で治療を受けたい、自分の意思で生活できるようになりたい"
                  value={freeText.want}
                  onChange={(e) => setFreeText({ ...freeText, want: e.target.value })}
                />
                <CharCounter current={freeText.want.length} max={CHAR_LIMITS.want} />
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

      {/* 3件制限モーダル */}
      <Modal
        isOpen={showLimitModal}
        onClose={() => router.push('/sos/dashboard')}
        title="相談件数の上限に達しています"
        type="warning"
      >
        <div className="text-center py-4">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 mb-4 font-medium">進行中の相談は最大3件までです。</p>
          <p className="text-sm text-gray-600 mb-6">
            ダッシュボードから既存の相談を取り消してから、<br />
            新しい相談を登録してください。
          </p>
          <button
            onClick={() => router.push('/sos/dashboard')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ダッシュボードへ戻る
          </button>
        </div>
      </Modal>
    </div>
  );
}