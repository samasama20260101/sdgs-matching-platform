// src/app/supporters/page.tsx（認証不要・公開）
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/icons/Logo';
import { getSupporterTypeConfig } from '@/lib/supporterType';
import { supabase } from '@/lib/supabase/client';

type Supporter = {
  id: string; display_name: string; organization_name: string | null;
  supporter_type: string; service_area_nationwide: boolean;
  service_areas: Array<{ region_code: string; name_local: string; name_en: string; country: string }>;
  resolved_count: number; badge_count: number;
};

export default function SupportersPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [displayCount, setDisplayCount] = useState(20); // 最初は20件表示
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const handleTypeFilter = (v: string | null) => { setTypeFilter(v); setDisplayCount(20); };
  const [userRegionCode, setUserRegionCode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/public/supporters')
      .then(r => r.json())
      .then(d => {
        if (d.error) setApiError(d.error);
        setSupporters(d.supporters || []);
        setIsLoading(false);
      })
      .catch(e => { setApiError(String(e)); setIsLoading(false); });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch('/api/auth/get-role', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (d.role === 'SOS' && d.user?.sos_region_code) {
            setUserRegionCode(d.user.sos_region_code);
          }
        });
    });
  }, []);

  const isRegionMatch = (s: Supporter) =>
    s.service_area_nationwide ||
    (s.service_areas || []).some(r => r.region_code === userRegionCode);

  const sortedSupporters = userRegionCode
    ? [...supporters].sort((a, b) => {
        const aMatch = isRegionMatch(a);
        const bMatch = isRegionMatch(b);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      })
    : supporters;

  const filtered = typeFilter
    ? sortedSupporters.filter(s => s.supporter_type === typeFilter)
    : sortedSupporters;

  const regionMatchCount = userRegionCode ? supporters.filter(isRegionMatch).length : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center no-underline">
            <Logo variant="default" size="sm" showText={true} />
          </Link>
          <div className="flex gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">ログイン</Link>
            <Link href="/signup" className="text-sm bg-teal-500 hover:bg-teal-600 text-white px-4 py-1.5 rounded-full transition-colors font-medium">
              相談する
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-gray-400 hover:text-teal-500 transition-colors">← トップに戻る</Link>
        <h1 className="text-2xl font-black text-gray-800 mt-3">登録サポーター一覧</h1>
        <p className="text-gray-500 text-sm mt-1">
          相談前にどんな団体が参加しているか確認できます
          {supporters.length > 0 && <span className="ml-2 text-teal-600 font-bold">{supporters.length}団体</span>}
        </p>

        {userRegionCode && regionMatchCount > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-sm text-teal-700">
            <span>📍</span>
            <span>あなたの地域をカバーする <strong>{regionMatchCount}団体</strong> を上位に表示しています</span>
          </div>
        )}

        <div className="flex gap-2 mt-5 mb-6">
          {[
            { key: null, label: 'すべて' },
            { key: 'NPO', label: '🌿 NPO・支援団体' },
            { key: 'CORPORATE', label: '🏢 企業' },
            { key: 'GOVERNMENT', label: '🏛️ 行政・公共機関' },
          ].map(({ key, label }) => (
            <button key={String(key)} onClick={() => setTypeFilter(key)}
              className={`text-xs font-bold px-4 py-2 rounded-full transition-all border ${typeFilter === key
                ? 'bg-teal-500 text-white border-teal-500'
                : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {apiError ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-red-500 font-bold mb-2">データ取得エラー</p>
            <p className="text-xs text-gray-400 bg-gray-100 px-4 py-2 rounded-lg inline-block">{apiError}</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-3xl mb-3">🔍</div>
            <p>読み込み中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-3xl mb-3">😢</div>
            <p>該当するサポーターが見つかりませんでした</p>
            <button onClick={() => handleTypeFilter(null)} className="mt-3 text-sm text-teal-500 hover:text-teal-600">
              フィルターをリセット
            </button>
          </div>
        ) : (
          <>
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.slice(0, displayCount).map(s => {
              const matched = !!(userRegionCode && isRegionMatch(s));
              return (
                <Link key={s.id} href={`/supporters/${s.id}`}
                  className={`bg-white rounded-2xl p-5 shadow-sm border transition-all block hover:shadow-md ${
                    matched ? 'border-teal-300 hover:border-teal-400' : 'border-gray-100 hover:border-teal-100'
                  }`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                      {getSupporterTypeConfig(s.supporter_type).emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">
                          {s.organization_name || s.display_name}
                        </h3>
                        {matched && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium whitespace-nowrap">
                            📍 あなたの地域
                          </span>
                        )}
                      </div>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${getSupporterTypeConfig(s.supporter_type).badgeClass} border`}>
                        {getSupporterTypeConfig(s.supporter_type).label}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mb-4">
                    📍 {s.service_area_nationwide
                      ? '全国対応'
                      : (s.service_areas || []).map(a => a.name_local).slice(0, 3).join(' · ')
                        + ((s.service_areas || []).length > 3 ? ' 他' : '')}
                  </div>

                  <div className="flex gap-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    <span>✅ 解決 <strong className="text-teal-600">{s.resolved_count}件</strong></span>
                    <span>🏆 <strong className="text-amber-500">{s.badge_count}バッジ</strong></span>
                  </div>
                </Link>
              );
            })}
          </div>
          {filtered.length > displayCount && (
            <div className="text-center mt-8">
              <button
                onClick={() => setDisplayCount(c => c + 20)}
                className="px-6 py-3 bg-white border border-teal-300 text-teal-600 rounded-full text-sm font-medium hover:bg-teal-50 transition-colors shadow-sm"
              >
                さらに表示 ({filtered.length - displayCount}団体)
              </button>
            </div>
          )}
          </>
        )}
      </main>
    </div>
  );
}
