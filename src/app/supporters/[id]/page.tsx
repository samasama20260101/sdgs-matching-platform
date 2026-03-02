// src/app/supporters/[id]/page.tsx（認証不要・公開プロフィール）
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type SocialLinks = {
  website?: string; twitter?: string;
  instagram?: string; facebook?: string; line?: string;
};

type Supporter = {
  id: string; display_name: string; organization_name: string | null;
  supporter_type: string; service_area_nationwide: boolean;
  service_areas: Array<{ prefecture: string }>;
  created_at: string; resolved_count: number;
  bio?: string | null; social_links?: SocialLinks | null;
};

const BADGE_INFO: Record<string, { emoji: string; label: string }> = {
  gold_medal: { emoji: '🥇', label: 'ありがとう（主要）' },
  silver_medal: { emoji: '🥈', label: 'ありがとう（サポート）' },
  very_satisfied: { emoji: '😆', label: '大満足' },
  quick_response: { emoji: '⚡', label: '迅速な対応' },
  sincere_support: { emoji: '💎', label: '誠実なサポート' },
  problem_solved: { emoji: '🌟', label: 'あきらめていた問題が解決' },
  grateful_partner: { emoji: '🤝', label: '一緒に向き合い大感謝' },
};

export default function SupporterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [supporter, setSupporter] = useState<Supporter | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/supporters/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push('/supporters'); return; }
        setSupporter(d.supporter);
        setBadges(d.badges || {});
        setIsLoading(false);
      })
      .catch(() => router.push('/supporters'));
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">🔍</div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!supporter) return null;

  const areas = supporter.service_area_nationwide
    ? ['全国対応']
    : (supporter.service_areas || []).map(a => a.prefecture);

  const totalBadges = Object.values(badges).reduce((s, n) => s + n, 0);
  const yearsActive = Math.max(1, Math.floor(
    (Date.now() - new Date(supporter.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)
  ));
  const sl = supporter.social_links || {};
  const hasSocialLinks = !!(sl.website || sl.twitter || sl.instagram || sl.facebook || sl.line);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌍</span>
            <span className="font-bold text-gray-800 text-sm">明日もsamasama</span>
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

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/supporters" className="text-xs text-gray-400 hover:text-green-500 transition-colors">
          ← サポーター一覧に戻る
        </Link>

        {/* ── ヒーローカード ── */}
        <div className="mt-4 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* グラデーションバナー */}
          <div className="h-28 bg-gradient-to-r from-green-400 via-teal-400 to-blue-400 relative">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          </div>

          {/* プロフィール情報 */}
          <div className="px-6 pb-6">
            {/* アイコン + タイプバッジ */}
            <div className="relative z-10 flex items-end gap-4 -mt-8 mb-3">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md border-2 border-white flex items-center justify-center text-3xl flex-shrink-0">
                {supporter.supporter_type === 'NPO' ? '🌿' : '🏢'}
              </div>
              <div className="pb-1 flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${supporter.supporter_type === 'NPO'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                  {supporter.supporter_type === 'NPO' ? 'NPO / 支援団体' : '企業'}
                </span>
                <span className="text-xs text-gray-400">登録 {yearsActive}年</span>
              </div>
            </div>

            {/* 団体名 */}
            <h1 className="text-xl font-black text-gray-900 mb-4">
              {supporter.organization_name || supporter.display_name}
            </h1>

            {/* SNSリンク（団体名の下に独立配置） */}
            {hasSocialLinks && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                {sl.website && (
                  <a href={sl.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full transition-colors">
                    🌐 公式サイト
                  </a>
                )}
                {sl.twitter && (
                  <a href={sl.twitter.startsWith('http') ? sl.twitter : `https://twitter.com/${sl.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white bg-black hover:bg-gray-800 px-3 py-1.5 rounded-full transition-colors">
                    𝕏 {sl.twitter.startsWith('http') ? 'X (Twitter)' : `@${sl.twitter.replace('@', '')}`}
                  </a>
                )}
                {sl.instagram && (
                  <a href={sl.instagram.startsWith('http') ? sl.instagram : `https://instagram.com/${sl.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 px-3 py-1.5 rounded-full transition-colors">
                    IG {sl.instagram.startsWith('http') ? 'Instagram' : `@${sl.instagram.replace('@', '')}`}
                  </a>
                )}
                {sl.facebook && (
                  <a href={sl.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-full transition-colors">
                    👥 Facebook
                  </a>
                )}
                {sl.line && (
                  <span className="flex items-center gap-1.5 text-xs text-white bg-green-500 px-3 py-1.5 rounded-full">
                    💬 LINE: {sl.line}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 実績3点セット ── */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { value: supporter.resolved_count, label: '解決した相談', suffix: '件', color: 'text-green-600' },
            { value: totalBadges, label: '獲得バッジ', suffix: '個', color: 'text-amber-500' },
            { value: supporter.service_area_nationwide ? 47 : areas.length, label: '活動エリア', suffix: '都道府県', color: 'text-blue-600' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">{item.suffix}</div>
              <div className="text-xs text-gray-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── 自己紹介文 ── */}
        {supporter.bio && (
          <div className="mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>✍️</span> 自己紹介
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{supporter.bio}</p>
          </div>
        )}

        {/* ── 活動エリア ── */}
        <div className="mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>📍</span> 活動エリア
          </h2>
          {supporter.service_area_nationwide ? (
            <span className="inline-block bg-green-50 text-green-700 border border-green-200 text-sm font-bold px-4 py-2 rounded-full">
              🗾 全国対応
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {areas.map(area => (
                <span key={area} className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full">
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── 感謝バッジ ── */}
        {totalBadges > 0 && (
          <div className="mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span>🏆</span> 感謝バッジ
            </h2>
            <p className="text-xs text-gray-400 mb-4">相談者から贈られたバッジです</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(badges).map(([key, count]) => {
                const info = BADGE_INFO[key];
                if (!info || count === 0) return null;
                return (
                  <div key={key} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <span className="text-2xl">{info.emoji}</span>
                    <div>
                      <div className="text-xs font-bold text-amber-700">{info.label}</div>
                      <div className="text-xs text-amber-500">{count}回</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="mt-6 bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-6 text-white text-center">
          <p className="font-bold mb-1">この団体に相談したいですか？</p>
          <p className="text-green-100 text-xs mb-4">
            相談を投稿してサポーターを選ぶ仕組みです。<br />
            承認するまで個人情報は渡りません。
          </p>
          <Link href="/signup"
            className="inline-block bg-white text-green-600 font-bold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors text-sm shadow">
            無料で相談してみる →
          </Link>
        </div>
      </main>
    </div>
  );
}