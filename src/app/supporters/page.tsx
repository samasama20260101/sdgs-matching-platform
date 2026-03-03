// src/app/supporters/page.tsx（認証不要・公開）
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Supporter = {
  id: string; display_name: string; organization_name: string | null;
  supporter_type: string; service_area_nationwide: boolean;
  service_areas: Array<{ region_code: string; name_local: string; name_en: string; country: string }>;
  resolved_count: number; badge_count: number;
};

export default function SupportersPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/public/supporters')
      .then(r => r.json())
      .then(d => {
        if (d.error) setApiError(d.error);
        setSupporters(d.supporters || []);
        setIsLoading(false);
      })
      .catch(e => { setApiError(String(e)); setIsLoading(false); });
  }, []);

  const filtered = typeFilter ? supporters.filter(s => s.supporter_type === typeFilter) : supporters;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌍</span>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-gray-800 text-sm">明日もsamasama</span>
              <span className="text-[9px] font-medium text-gray-400 tracking-wide">SDGs Match</span>
            </div>
          </Link>
          <div className="flex gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">ログイン</Link>
            <Link href="/signup"
              className="text-sm bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-full transition-colors font-medium">
              相談する
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-gray-400 hover:text-green-500 transition-colors">← トップに戻る</Link>
        <h1 className="text-2xl font-black text-gray-800 mt-3">登録サポーター一覧</h1>
        <p className="text-gray-500 text-sm mt-1">
          相談前にどんな団体が参加しているか確認できます
          {supporters.length > 0 && <span className="ml-2 text-green-600 font-bold">{supporters.length}団体</span>}
        </p>

        {/* タイプフィルター */}
        <div className="flex gap-2 mt-5 mb-6">
          {[
            { key: null, label: 'すべて' },
            { key: 'NPO', label: '🌿 NPO・支援団体' },
            { key: 'CORPORATE', label: '🏢 企業' },
          ].map(({ key, label }) => (
            <button key={String(key)}
              onClick={() => setTypeFilter(key)}
              className={`text-xs font-bold px-4 py-2 rounded-full transition-all border ${typeFilter === key
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'
                }`}>
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
            <button onClick={() => setTypeFilter(null)} className="mt-3 text-sm text-green-500 hover:text-green-600">
              フィルターをリセット
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map(s => (
              <Link key={s.id} href={`/supporters/${s.id}`}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-green-100 transition-all block">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {s.supporter_type === 'NPO' ? '🌿' : '🏢'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">
                      {s.organization_name || s.display_name}
                    </h3>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.supporter_type === 'NPO'
                        ? 'text-green-600 bg-green-50 border border-green-200'
                        : 'text-blue-600 bg-blue-50 border border-blue-200'
                      }`}>
                      {s.supporter_type === 'NPO' ? 'NPO / 支援団体' : '企業'}
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
                  <span>✅ 解決 <strong className="text-green-600">{s.resolved_count}件</strong></span>
                  <span>🏆 <strong className="text-amber-500">{s.badge_count}バッジ</strong></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}