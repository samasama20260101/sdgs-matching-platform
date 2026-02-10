'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type UserData = {
  display_name: string;
  email: string;
  role: string;
};

export default function SOSDashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // ログイン確認
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // ユーザー情報取得
      const { data } = await supabase
        .from('users')
        .select('display_name, email, role')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!data || data.role !== 'SOS') {
        router.push('/');
        return;
      }

      setUserData(data);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

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
      
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ウェルカムメッセージ */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            こんにちは、{userData?.display_name} さん 👋
          </h1>
          <p className="text-gray-500 mt-1">
            困りごとを相談して、支援につながりましょう
          </p>
        </div>

        {/* アクションカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 相談を投稿 */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🆘</span>
                <span>相談を投稿する</span>
              </CardTitle>
              <CardDescription>
                困りごとを入力すると、AIが自動的にSDGsゴールに分類し、
                最適な支援組織をマッチングします
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                onClick={() => router.push('/sos/hearing')}
              >
                相談を始める
              </Button>
            </CardContent>
          </Card>

          {/* 過去の相談 */}
          <Card className="hover:shadow-md transition-shadow border-green-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <span>過去の相談</span>
              </CardTitle>
              <CardDescription>
                これまでに投稿した相談内容と、
                支援組織からの返答を確認できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/sos/cases')}
              >
                相談履歴を見る
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* SDGsゴール説明 */}
        <Card className="mt-6 bg-gradient-to-r from-blue-50 to-green-50 border-none">
          <CardHeader>
            <CardTitle className="text-lg">
              🌍 SDGsとは？
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm">
              SDGs（持続可能な開発目標）は、2030年までに達成すべき17の国際目標です。
              このプラットフォームでは、あなたの困りごとをAIが分析し、
              最も適切なSDGsゴールに分類して支援組織とつなぎます。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
