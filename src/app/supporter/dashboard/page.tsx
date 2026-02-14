'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Case = {
  id: string;
  title: string;
  description_free: string;
  urgency: string;
  status: string;
  created_at: string;
  region_country: string;
  region_area: string | null;
  ai_sdg_suggestion: {
    sdgs_goals: number[];
    reasoning: string;
    keywords: string[];
  } | null;
};

type UserData = {
  display_name: string;
  organization_name: string | null;
  role: string;
  service_area_nationwide?: boolean;
  service_areas?: Array<{
    prefecture: string;
    city?: string;
  }>;
};

// SDGsゴールの色と名前
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

export default function SupporterDashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      console.log('🔄 Loading supporter dashboard data...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('❌ No session, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('✅ Session exists, user ID:', session.user.id);

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('display_name, organization_name, role, service_area_nationwide, service_areas')
        .eq('auth_user_id', session.user.id)
        .single();

      console.log('📊 User query result:', { user, userError });

      if (userError) {
        console.error('❌ User error:', userError);
        router.push('/login');
        return;
      }

      if (!user || user.role !== 'SUPPORTER') {
        console.log('❌ Not a supporter, role:', user?.role);
        router.push('/');
        return;
      }

      console.log('✅ User loaded:', user);
      setUserData(user);

      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select('*')
        .eq('visibility', 'LISTED')
        .eq('status', 'OPEN')
        .not('ai_sdg_suggestion', 'is', null)
        .order('created_at', { ascending: false });

      console.log('📋 Cases query result:', { casesData, casesError });

      setCases(casesData || []);
      setFilteredCases(casesData || []);
      setIsLoading(false);
    };

    loadData();
  }, [router]);

  useEffect(() => {
    if (selectedGoal === null) {
      setFilteredCases(cases);
    } else {
      const filtered = cases.filter(c =>
        c.ai_sdg_suggestion?.sdgs_goals?.includes(selectedGoal)
      );
      setFilteredCases(filtered);
    }
  }, [selectedGoal, cases]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今日';
    if (days === 1) return '昨日';
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            こんにちは、{userData?.organization_name || userData?.display_name} さん 👋
          </h1>
          <p className="text-gray-500 mt-1">
            支援を必要としている方々の相談を確認できます
          </p>

          <div className="mt-3 flex items-start gap-2">
            <span className="text-sm text-gray-600 flex-shrink-0">📍 活動地域:</span>
            {userData?.service_area_nationwide ? (
              <span className="text-sm font-medium text-blue-600">全国対応</span>
            ) : userData?.service_areas && Array.isArray(userData.service_areas) && userData.service_areas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userData.service_areas.map((area: any, index: number) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200"
                  >
                    {area.prefecture}{area.city ? ` ${area.city}` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-orange-600">未設定</span>
                <a href="/profile" className="text-xs text-blue-600 hover:underline">
                  → 設定する
                </a>
              </div>
            )}
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">🎯 SDGsゴールで絞り込み</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGoal(null)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedGoal === null
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                すべて ({cases.length})
              </button>
              {[1, 2, 3, 4, 5, 8, 10, 11, 16].map((goalId) => {
                const count = cases.filter(c =>
                  c.ai_sdg_suggestion?.sdgs_goals?.includes(goalId)
                ).length;

                if (count === 0) return null;

                return (
                  <button
                    key={goalId}
                    onClick={() => setSelectedGoal(goalId)}
                    className={`px-3 py-1 rounded-full text-sm text-white transition-opacity ${selectedGoal === goalId ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                      }`}
                    style={{ backgroundColor: SDG_COLORS[goalId] }}
                  >
                    SDG {goalId} ({count})
                  </button>
                );
              }).filter(Boolean)}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {filteredCases.length}
              </div>
              <p className="text-sm text-gray-500 mt-1">相談件数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-red-600">
                {filteredCases.filter(c => c.urgency === 'High').length}
              </div>
              <p className="text-sm text-gray-500 mt-1">緊急案件</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-600">
                {new Set(filteredCases.flatMap(c => c.ai_sdg_suggestion?.sdgs_goals || [])).size}
              </div>
              <p className="text-sm text-gray-500 mt-1">関連SDGs</p>
            </CardContent>
          </Card>
        </div>

        {filteredCases.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-500">
                {selectedGoal !== null
                  ? `SDG ${selectedGoal} に該当する相談はありません`
                  : '現在、公開されている相談はありません'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCases.map((c) => (
              <Card
                key={c.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-l-4"
                style={{
                  borderLeftColor: c.urgency === 'High'
                    ? '#ef4444'
                    : SDG_COLORS[c.ai_sdg_suggestion?.sdgs_goals?.[0] || 1],
                }}
                onClick={() => router.push(`/supporter/case/${c.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      {c.title}
                    </CardTitle>
                    <div className="flex gap-2 flex-shrink-0">
                      {c.urgency === 'High' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">
                          ⚠️ 緊急
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                        {c.region_country}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {c.description_free}
                  </p>

                  {c.ai_sdg_suggestion?.keywords && (
                    <div className="flex flex-wrap gap-1">
                      {c.ai_sdg_suggestion.keywords.slice(0, 3).map((kw, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {c.ai_sdg_suggestion?.sdgs_goals?.map((goalId) => (
                        <span
                          key={goalId}
                          className="text-white text-xs font-bold px-2 py-1 rounded"
                          style={{ backgroundColor: SDG_COLORS[goalId] }}
                          title={SDG_NAMES[goalId]}
                        >
                          {goalId}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">
                      📅 {formatDate(c.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}