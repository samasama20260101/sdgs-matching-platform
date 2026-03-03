// src/app/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Stats = { resolvedCount: number; supporterCount: number; areaCount: number };
type Supporter = {
  id: string; display_name: string; organization_name: string | null;
  supporter_type: string; service_area_nationwide: boolean;
  service_areas: Array<{ name_local: string }>; sdgs_goals: number[];
  resolved_count: number; badge_count: number;
};

const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d', 5: '#ff3a21',
  6: '#26bde2', 7: '#fcc30b', 8: '#a21942', 9: '#fd6925', 10: '#dd1367',
  11: '#fd9d24', 12: '#bf8b2e', 13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b',
  16: '#00689d', 17: '#19486a',
};
const SDG_NAMES: Record<number, string> = {
  1: '貧困', 2: '飢餓', 3: '健康', 4: '教育', 5: 'ジェンダー',
  6: '水・衛生', 7: 'エネルギー', 8: '経済成長', 9: '産業・技術', 10: '不平等',
  11: 'まちづくり', 12: '生産・消費', 13: '気候変動', 14: '海洋', 15: '陸上',
  16: '平和・公正', 17: 'パートナー',
};

const STEPS = [
  { icon: '📝', title: '相談を投稿', desc: '困っていることを自由に入力。個人情報は最小限でOK' },
  { icon: '🤖', title: 'AIが分析', desc: 'AIが相談内容を解析し、最適なSDGsカテゴリを判定' },
  { icon: '🤝', title: 'サポーターが申し出', desc: '専門分野のNPO・支援団体があなたの相談に手を挙げます' },
  { icon: '✅', title: 'あなたが選ぶ', desc: '申し出た団体の情報を確認してから承認。断ることも自由' },
  { icon: '🌟', title: '解決・サポート完了', desc: '問題が解決したら確認。感謝バッジで気持ちを伝えられます' },
];

const FAQS = [
  {
    q: '個人情報は大丈夫ですか？',
    a: 'サポーターを承認するまで、個人を特定できる情報は一切渡りません。承認後も必要最小限の情報のみ共有されます。',
  },
  {
    q: 'サポーターの申し出を断ることはできますか？',
    a: 'はい、自由に断れます。申し出を受けるかどうかはあなたが決めます。納得できるまで待つことも可能です。',
  },
  {
    q: '本当に無料ですか？',
    a: 'SOS利用者の方は完全無料です。サポーターのNPO・企業も登録費用はかかりません。',
  },
  {
    q: '怪しい団体が来たらどうなりますか？',
    a: 'すべてのサポーター団体は登録時に審査を受けています。また、プロフィールで実績や紹介文を事前確認できます。',
  },
  {
    q: '何でも相談していいですか？',
    a: 'SDGsに関連する社会的な困りごとが対象です。生活困窮、教育、環境、差別、孤立など幅広く対応できます。',
  },
];

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !ref.current) {
        ref.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(ease * target));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    if (nodeRef.current) observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, nodeRef };
}

function StatCard({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const { count, nodeRef } = useCountUp(value);
  return (
    <div ref={nodeRef} className="text-center p-6">
      <div className="text-4xl font-black text-green-600 mb-1">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/public/stats').then(r => r.json()).then(setStats).catch(() => { });
    fetch('/api/public/supporters').then(r => r.json()).then(d => setSupporters(d.supporters || [])).catch(() => { });

    // ログイン済みなら自動でダッシュボードへ
    import('@/lib/supabase/client').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        setIsLoggedIn(true);
        fetch('/api/auth/get-role', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
          .then(r => r.json())
          .then(d => {
            if (d.role === 'SOS') router.replace('/sos/dashboard');
            else if (d.role === 'SUPPORTER') router.replace('/supporter/dashboard');
            else if (d.role === 'ADMIN') router.replace('/admin/dashboard');
          });
      });
    });
  }, [router]);

  const previewSupporters = supporters.slice(0, 4);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌍</span>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-gray-800 text-sm">明日もsamasama</span>
              <span className="text-[9px] font-medium text-gray-400 tracking-wide">SDGs Match</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/supporters" className="text-sm text-gray-500 hover:text-green-600 transition-colors">
              サポーター一覧
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              ログイン
            </Link>
            <Link href="/signup"
              className="text-sm bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-full transition-colors font-medium">
              相談する
            </Link>
          </div>
        </div>
      </header>

      {/* ── ヒーロー ── */}
      <section className="bg-gradient-to-br from-green-50 via-blue-50 to-white pt-20 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-wide">
            NPO・支援団体と繋がるプラットフォーム
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight mb-6">
            ひとりで抱えずに、<br />
            <span className="text-green-500">誰かと一緒に</span>解決しよう
          </h1>
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            生活困窮・教育・環境・差別・孤立など、社会的な困りごとを<br className="hidden sm:block" />
            AIが分析し、専門のNPO・支援団体へつなぎます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              無料で相談する →
            </Link>
            <Link href="/supporters"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 rounded-2xl font-bold text-lg transition-all">
              サポーターを見る
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">登録無料・承認するまで個人情報は渡りません</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-400">
            <span>すでにアカウントをお持ちの方は</span>
            <Link href="/login" className="text-green-600 font-bold hover:text-green-700 border-b border-dashed border-green-400 hover:border-green-600 transition-colors">
              こちらからログイン →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 実績カウンター ── */}
      {stats && (
        <section className="border-y border-gray-100 bg-white">
          <div className="max-w-3xl mx-auto grid grid-cols-3 divide-x divide-gray-100">
            <StatCard value={stats.resolvedCount} label="解決した相談" suffix="件" />
            <StatCard value={stats.supporterCount} label="登録サポーター団体" suffix="団体" />
            <StatCard value={stats.areaCount} label="活動都道府県" suffix="都道府県" />
          </div>
        </section>
      )}

      {/* ── 仕組みフロー ── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-3">ご利用の流れ</h2>
            <p className="text-gray-500">安心してご利用いただけるよう、透明なプロセスで進みます</p>
          </div>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-5 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex-shrink-0 w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl">
                  {step.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                      STEP {i + 1}
                    </span>
                    <span className="font-bold text-gray-800">{step.title}</span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  {i === 3 && (
                    <p className="text-xs text-orange-500 font-medium mt-1.5">
                      🔒 承認しない限り個人情報は渡りません
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SDGs対応ゴール ── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-black text-gray-900 mb-3">対応するSDGsゴール</h2>
          <p className="text-gray-500 mb-8 text-sm">17のゴールすべての領域で、専門の支援団体が活動しています</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {Array.from({ length: 17 }, (_, i) => i + 1).map(g => (
              <span key={g} style={{ background: SDG_COLORS[g] }}
                className="text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                {g} {SDG_NAMES[g]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── サポーター一覧プレビュー ── */}
      {previewSupporters.length > 0 && (
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900">参加サポーター</h2>
                <p className="text-gray-500 text-sm mt-1">事前に確認してから相談できます</p>
              </div>
              <Link href="/supporters"
                className="text-sm text-green-600 hover:text-green-700 font-medium border border-green-200 px-4 py-2 rounded-full hover:bg-green-50 transition-colors">
                全{supporters.length}団体を見る →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {previewSupporters.map(s => (
                <Link key={s.id} href={`/supporters/${s.id}`}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-green-100 transition-all block">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center text-xl flex-shrink-0">
                      {s.supporter_type === 'NPO' ? '🌿' : '🏢'}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm leading-tight">
                        {s.organization_name || s.display_name}
                      </h3>
                      <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                        {s.supporter_type === 'NPO' ? 'NPO / 支援団体' : '企業'}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    📍 {s.service_area_nationwide ? '全国対応' : (s.service_areas || []).map(a => a.name_local).slice(0, 3).join(' · ')}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(s.sdgs_goals || []).slice(0, 5).map(g => (
                      <span key={g} style={{ background: SDG_COLORS[g] }}
                        className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        SDG{g}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    <span>✅ 解決 <strong className="text-green-600">{s.resolved_count}件</strong></span>
                    <span>🏆 <strong className="text-amber-500">{s.badge_count}バッジ</strong></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── よくある質問 ── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-gray-900 text-center mb-8">よくある不安・質問</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <span className="font-bold text-gray-800 text-sm">{faq.q}</span>
                  <span className="text-gray-400 text-lg ml-4 flex-shrink-0">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 最終CTA ── */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-500 to-teal-500 text-white text-center">
        <div className="max-w-xl mx-auto">
          <div className="text-4xl mb-4">🌍</div>
          <h2 className="text-3xl font-black mb-4">一歩踏み出してみませんか</h2>
          <p className="text-green-100 mb-8 leading-relaxed">
            あなたの困りごとを解決できる専門家が、待っています。<br />
            相談は無料。承認するまで個人情報は渡りません。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="px-8 py-4 bg-white text-green-600 rounded-2xl font-bold text-lg hover:bg-green-50 transition-all shadow-lg">
              無料で相談する →
            </Link>
            <Link href="/login"
              className="px-8 py-4 bg-green-600/40 hover:bg-green-600/60 text-white border border-white/30 rounded-2xl font-bold text-lg transition-all">
              ログインする
            </Link>
          </div>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-xs">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">🌍</span>
          <span className="font-bold text-white">明日もsamasama</span><span className="text-xs text-white/60 ml-1">SDGs Match</span>
        </div>
        <p>© 2024 SDGs Matching Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}