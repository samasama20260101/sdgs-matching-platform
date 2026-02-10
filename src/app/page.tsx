import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-green-50">
      <div className="text-center space-y-8 max-w-2xl">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
          SDGsマッチングプラットフォーム
        </h1>
        
        <p className="text-xl text-gray-600">
          困っている人とNPO/支援組織をAIで自動マッチング
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/signup"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 text-center font-medium shadow-lg hover:shadow-xl transition-all"
          >
            新規登録
          </Link>
          
          <Link 
            href="/test-ai"
            className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 text-center font-medium shadow-lg hover:shadow-xl transition-all"
          >
            AI分類テスト
          </Link>
        </div>
      </div>
    </div>
  );
}
