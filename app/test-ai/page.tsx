'use client';

import { useState } from 'react';

export default function TestAIPage() {
  const [consultationText, setConsultationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/classify-sdgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consultationText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          AI機能テスト - SDGs分類
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="consultation"
                className="block text-lg font-semibold text-gray-700 mb-3"
              >
                相談内容を入力してください
              </label>
              <textarea
                id="consultation"
                rows={6}
                className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={consultationText}
                onChange={(e) => setConsultationText(e.target.value)}
                placeholder="例: 近所の子どもたちに無料で勉強を教えたいのですが、場所や教材が不足しています。"
              />
            </div>

            <div className="flex flex-col items-center">
              <button
                type="submit"
                disabled={loading || consultationText.length < 10}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xl font-bold py-5 px-12 rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-2xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-110 shadow-lg"
              >
                {loading ? '🔄 分析中...' : '🚀 SDGsゴールを分類する'}
              </button>
              
              {consultationText.length < 10 && consultationText.length > 0 && (
                <p className="text-sm text-red-500 mt-3">
                  あと{10 - consultationText.length}文字入力してください
                </p>
              )}
            </div>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">❌ エラー</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ✅ 分類結果
            </h2>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                関連するSDGsゴール
              </h3>
              <div className="flex gap-3">
                {result.sdgs_goals?.map((goal: number) => (
                  <span
                    key={goal}
                    className="inline-block bg-blue-100 text-blue-800 px-5 py-3 rounded-full font-bold text-lg"
                  >
                    ゴール {goal}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                分類理由
              </h3>
              <p className="text-gray-600 leading-relaxed text-base">
                {result.reasoning}
              </p>
            </div>

            {result.keywords && result.keywords.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  抽出されたキーワード
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword: string, index: number) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-900 font-semibold mb-3 text-lg">
            💡 テストのヒント
          </h3>
          <ul className="text-blue-800 space-y-2">
            <li>• 教育に関する相談 → ゴール4（質の高い教育）</li>
            <li>• 貧困・生活困窮 → ゴール1（貧困をなくそう）</li>
            <li>• 健康・医療 → ゴール3（健康と福祉）</li>
            <li>• 環境問題 → ゴール13（気候変動）、14（海）、15（陸）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
