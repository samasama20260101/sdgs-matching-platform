'use client';

// app/test-ai/page.tsx
// AI機能テストページ

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
            <div className="mb-4">
              <label
                htmlFor="consultation"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                相談内容を入力してください
              </label>
              <textarea
                id="consultation"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={consultationText}
                onChange={(e) => setConsultationText(e.target.value)}
                placeholder="例: 近所の子どもたちに無料で勉強を教えたいのですが、場所や教材が不足しています。どのような支援を受けられますか？"
              />
            </div>

            <button
              type="submit"
              disabled={loading || consultationText.length < 10}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '分析中...' : 'SDGsゴールを分類'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">エラー</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              分類結果
            </h2>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                関連するSDGsゴール
              </h3>
              <div className="flex gap-2">
                {result.sdgs_goals?.map((goal: number) => (
                  <span
                    key={goal}
                    className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold"
                  >
                    ゴール {goal}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                分類理由
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {result.reasoning}
              </p>
            </div>

            {result.keywords && result.keywords.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  抽出されたキーワード
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword: string, index: number) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 font-semibold mb-2">
            テストのヒント
          </h3>
          <ul className="text-blue-800 text-sm space-y-1">
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