import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          SDGsマッチングプラットフォーム
        </h1>

        <p className="text-gray-600 mb-8">開発中のプラットフォームです</p>

        <Link
          href="/test-ai"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
        >
          AI機能テストページへ
        </Link>
      </div>
    </div>
  );
}