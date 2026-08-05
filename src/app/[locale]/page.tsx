// src/app/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Instagram } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { getSupporterTypeConfig } from '@/lib/supporterType';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { SDG_COLORS } from '@/lib/constants/sdgs';
import { ACTIVE_DISASTER_EVENT } from '@/lib/constants/disaster';
import { Logo } from '@/components/icons/Logo';
import { ShareButtons } from '@/components/marketing/ShareButtons';

const INSTAGRAM_URL = 'https://www.instagram.com/seeyou.samasama/';

type Stats = { resolvedCount: number; supporterCount: number; areaCount: number };
type Supporter = {
  id: string; display_name: string; organization_name: string | null;
  supporter_type: string; service_area_nationwide: boolean;
  service_areas: Array<{ name_local: string }>; sdgs_goals: number[];
  resolved_count: number; badge_count: number;
};

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

function StatCard({ value, label, suffix = '', suffixSm }: { value: number; label: string; suffix?: string; suffixSm?: string }) {
  const { count, nodeRef } = useCountUp(value);
  return (
    <div ref={nodeRef} className="flex flex-col items-center justify-center text-center px-2 py-5 sm:p-8">
      {/* 数値 */}
      <div className="text-2xl sm:text-4xl font-black text-teal-600 leading-none whitespace-nowrap">
        {count.toLocaleString()}
        {/* スマホ: 短い単位 / デスクトップ: 通常単位 */}
        {(suffixSm ?? suffix) && <span className="text-base sm:text-2xl ml-0.5 sm:hidden">{suffixSm ?? suffix}</span>}
        {suffix && <span className="text-2xl ml-0.5 hidden sm:inline">{suffix}</span>}
      </div>
      {/* ラベル */}
      <div className="text-[10px] sm:text-sm text-gray-500 font-medium leading-snug mt-1.5 break-keep">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const t = useTranslations('landing');
  const tDisaster = useTranslations('sos.disaster');
  const tGoalShort = useTranslations('sdgs.goalShort');
  const tSupporterType = useTranslations('common.supporterType');
  const [stats, setStats] = useState<Stats | null>(null);
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [featuredSupporters, setFeaturedSupporters] = useState<Supporter[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/public/stats').then(r => r.json()).then(setStats).catch(() => { });
    fetch('/api/public/supporters').then(r => r.json()).then(d => setSupporters(d.supporters || [])).catch(() => { });
    fetch('/api/public/featured-supporters').then(r => r.json()).then(d => setFeaturedSupporters(d.supporters || [])).catch(() => { });

    // ログイン済みなら自動でダッシュボードへ
    import('@/lib/supabase/client').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
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

  // フィーチャードが設定されていればそれを、なければ登録順上位4件を表示
  const previewSupporters = featuredSupporters.length > 0 ? featuredSupporters : supporters.slice(0, 4);

  const STEPS = [
    { icon: '📝', title: t('steps.step1Title'), desc: t('steps.step1Desc') },
    { icon: '🤖', title: t('steps.step2Title'), desc: t('steps.step2Desc') },
    { icon: '🤝', title: t('steps.step3Title'), desc: t('steps.step3Desc') },
    { icon: '✅', title: t('steps.step4Title'), desc: t('steps.step4Desc') },
    { icon: '🌟', title: t('steps.step5Title'), desc: t('steps.step5Desc') },
  ];

  const FAQS = [1, 2, 3, 4, 5].map((n) => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }));

  const CONCEPT_POINTS = [1, 2, 3].map((n) => ({
    title: t(`concept.point${n}Title`),
    desc: t(`concept.point${n}Desc`),
  }));

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* スマホはアイコンのみ(テキスト込みだと言語スイッチャーと合わせて幅超過) */}
          <span className="sm:hidden"><Logo variant="default" size="sm" showText={false} /></span>
          <span className="hidden sm:block"><Logo variant="default" size="sm" showText={true} /></span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/supporters" className="hidden sm:block text-sm text-gray-500 hover:text-teal-600 transition-colors">
              {t('nav.supporters')}
            </Link>
            <Link href="/story" className="hidden sm:block text-sm text-gray-500 hover:text-teal-600 transition-colors">
              {t('nav.story')}
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap">
              {t('nav.login')}
            </Link>
            <Link href="/signup"
              className="text-sm bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-4 py-1.5 rounded-full transition-colors font-medium whitespace-nowrap">
              {t('nav.consult')}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* ── 災害SOSバナー（受付中の災害イベントがあるときだけ表示） ── */}
      {ACTIVE_DISASTER_EVENT && (
        <div className="bg-rose-600 text-white px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="flex-1 text-sm font-bold leading-relaxed">
              🆘 {tDisaster('banner.title', { event: tDisaster(`events.${ACTIVE_DISASTER_EVENT.i18nKey}`) })}
              <span className="font-normal opacity-90 ml-2">{tDisaster('banner.body')}</span>
            </p>
            <Link href="/sos/disaster"
              className="self-start sm:self-auto flex-shrink-0 text-sm font-bold bg-white text-rose-600 hover:bg-rose-50 px-4 py-1.5 rounded-full transition-colors whitespace-nowrap">
              {tDisaster('banner.cta')}
            </Link>
          </div>
        </div>
      )}

      {/* ── ヒーロー ── */}
      <section className="bg-gradient-to-br from-teal-50 via-blue-50 to-white pt-14 sm:pt-20 pb-16 sm:pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full mb-5 tracking-wide">
            {t('hero.badge')}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 leading-tight mb-5">
            {t.rich('hero.title', {
              br: () => <br />,
              accent: (chunks) => <span className="text-teal-500">{chunks}</span>,
            })}
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mb-8 leading-relaxed">
            {t('hero.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="px-8 py-4 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              {t('hero.ctaConsult')}
            </Link>
            <Link href="/supporters"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 rounded-2xl font-bold text-lg transition-all">
              {t('hero.ctaSupporters')}
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">{t('hero.note')}</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-400">
            <span>{t('hero.haveAccount')}</span>
            <Link href="/login" className="text-teal-600 font-bold hover:text-teal-700 border-b border-dashed border-teal-400 hover:border-teal-600 transition-colors">
              {t('hero.loginHere')}
            </Link>
          </div>
          <div className="mt-6">
            <Link href="/story" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors group">
              <svg width="14" height="14" viewBox="0 0 56 56" fill="none">
                <path d="M28 4C28 4 8 24 8 38C8 49.5 17.1 54 28 54C38.9 54 48 49.5 48 38C48 24 28 4 28 4Z" fill="#0BC5A4"/>
              </svg>
              <span className="border-b border-dashed border-gray-300 group-hover:border-teal-400 transition-colors">{t('hero.readStory')}</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 実績カウンター ── */}
      {stats && (
        <section className="border-y border-gray-100 bg-white">
          <div className="max-w-3xl mx-auto grid grid-cols-3 divide-x divide-gray-100">
            <StatCard value={stats.resolvedCount} label={t('stats.resolved')} suffix={t('stats.resolvedSuffix')} />
            <StatCard value={stats.supporterCount} label={t('stats.supporters')} suffix={t('stats.supportersSuffix')} suffixSm={t('stats.supportersSuffix')} />
            <StatCard value={stats.areaCount} label={t('stats.areas')} suffix={t('stats.areasSuffix')} suffixSm={t('stats.areasSuffixSm')} />
          </div>
        </section>
      )}

      {/* ── サービス概念図モック ── */}
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold tracking-[0.18em] text-teal-600">{t('concept.kicker')}</p>
            <h2 className="text-2xl font-black leading-tight text-gray-900 sm:text-3xl">
              {t('concept.title')}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-base">
              {t('concept.description')}
            </p>
          </div>

          <div className="relative mx-auto mt-8 max-w-[430px] md:max-w-5xl">
            <Image
              src="/concepts/top-concept-mobile-sample-b.png"
              alt={t('concept.imageAltMobile')}
              width={864}
              height={1821}
              className="block h-auto w-full md:hidden"
            />
            <Image
              src="/concepts/top-concept-flow-v1-transparent-no-bottom.png"
              alt={t('concept.imageAltDesktop')}
              width={1672}
              height={941}
              className="hidden h-auto w-full md:block"
            />
            <p className="mx-auto mt-7 max-w-3xl text-center text-2xl font-black leading-tight text-gray-900 sm:mt-8 sm:text-3xl md:-mt-[7%] md:text-4xl">
              {t.rich('concept.caption', {
                accent: (chunks) => <span className="text-teal-600">{chunks}</span>,
              })}
            </p>
          </div>

          <div className="mt-5 hidden gap-3 sm:mt-6 md:grid md:grid-cols-3">
            {CONCEPT_POINTS.map((point, index) => (
              <div key={point.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">{point.title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">{point.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 仕組みフロー ── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-gray-900 mb-3">{t('steps.title')}</h2>
            <p className="text-gray-500">{t('steps.subtitle')}</p>
          </div>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-5 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex-shrink-0 w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-2xl">
                  {step.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-teal-500 bg-teal-50 px-2 py-0.5 rounded-full">
                      {t('steps.label', { n: i + 1 })}
                    </span>
                    <span className="font-bold text-gray-800">{step.title}</span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  {i === 3 && (
                    <p className="text-xs text-orange-500 font-medium mt-1.5">
                      {t('steps.privacyNote')}
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
          <h2 className="text-2xl font-black text-gray-900 mb-3">{t('sdgsSection.title')}</h2>
          <p className="text-gray-500 mb-8 text-sm">{t('sdgsSection.subtitle')}</p>
          {/* 国連公式アイコン(日本語版・国連広報センター配布)。PC 6列×3段・スマホ 3列×6段、18枚目はSDGsカラーホイール */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {Array.from({ length: 17 }, (_, i) => i + 1).map(g => (
              <Image key={g}
                src={`/sdgs/sdg-${String(g).padStart(2, '0')}-ja.webp`}
                alt={`SDGs ${g} ${tGoalShort(String(g))}`}
                width={320} height={320}
                className="w-full h-auto rounded-md shadow-sm" />
            ))}
            <div className="flex items-center justify-center p-1.5">
              <Image src="/sdgs/sdg-wheel.webp" alt="SDGs"
                width={320} height={320}
                className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ── サポーター一覧プレビュー ── */}
      {previewSupporters.length > 0 && (
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{t('supportersSection.title')}</h2>
                <p className="text-gray-500 text-sm mt-1">{featuredSupporters.length > 0 ? t('supportersSection.subtitleFeatured') : t('supportersSection.subtitleDefault')}</p>
              </div>
              <Link href="/supporters"
                className="self-start sm:self-auto text-sm text-teal-600 hover:text-teal-700 font-medium border border-teal-200 px-4 py-2 rounded-full hover:bg-teal-50 transition-colors whitespace-nowrap">
                {t('supportersSection.viewAll', { count: supporters.length })}
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {previewSupporters.map(s => (
                <Link key={s.id} href={`/supporters/${s.id}`}
                  className="block min-w-0 overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-100 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-50 to-blue-100 flex items-center justify-center text-xl flex-shrink-0">
                      {getSupporterTypeConfig(s.supporter_type).emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 text-sm leading-tight break-all">
                        {s.organization_name || s.display_name}
                      </h3>
                      <span className={`mt-1 inline-flex max-w-full whitespace-normal break-all text-xs rounded-full px-2 py-0.5 font-medium border ${getSupporterTypeConfig(s.supporter_type).badgeClass}`}>
                        {tSupporterType(s.supporter_type)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mb-3 break-all">
                    📍 {s.service_area_nationwide ? t('supportersSection.nationwide') : (s.service_areas || []).map(a => a.name_local).slice(0, 3).join(' · ')}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(s.sdgs_goals || []).slice(0, 5).map(g => (
                      <span key={g} style={{ background: SDG_COLORS[g] }}
                        className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        SDG{g}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    <span>{t.rich('supportersSection.resolvedStat', {
                      count: s.resolved_count,
                      strong: (chunks) => <strong className="text-teal-600">{chunks}</strong>,
                    })}</span>
                    <span>{t.rich('supportersSection.badgeStat', {
                      count: s.badge_count,
                      strong: (chunks) => <strong className="text-amber-500">{chunks}</strong>,
                    })}</span>
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
          <h2 className="text-2xl font-black text-gray-900 text-center mb-8">{t('faq.title')}</h2>
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
      <section className="py-20 px-6 bg-gradient-to-br from-teal-500 to-teal-500 text-white text-center">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-center mb-4">
            <Logo variant="white" size="md" showText={false} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-4">{t('cta.title')}</h2>
          <p className="text-sm sm:text-base text-teal-100 mb-8 leading-relaxed">
            {t('cta.body')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup"
              className="px-8 py-4 bg-white text-teal-600 rounded-2xl font-bold text-lg hover:bg-teal-50 transition-all shadow-lg">
              {t('cta.consult')}
            </Link>
            <Link href="/login"
              className="px-8 py-4 bg-teal-600/40 hover:bg-teal-600/60 text-white border border-white/30 rounded-2xl font-bold text-lg transition-all">
              {t('cta.login')}
            </Link>
          </div>

          {/* シェア導線（マーケティング用） */}
          <ShareButtons />

          {/* 公式Instagramフォロー導線（シェアとは別の行為なので列に混ぜず一段分ける） */}
          <div className="mt-4 flex justify-center">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10">
              <Instagram className="h-4 w-4" aria-hidden="true" />
              @seeyou.samasama
            </a>
          </div>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6 text-center text-xs">
        <div className="flex justify-center mb-4">
          <Logo variant="white" size="sm" showText={true} />
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4 text-gray-500">
          <Link href="/story" className="hover:text-teal-400 transition-colors tracking-wide">{t('footer.story')}</Link>
          <Link href="/supporters" className="hover:text-teal-400 transition-colors tracking-wide">{t('footer.supporters')}</Link>
          <Link href="/contact" className="hover:text-teal-400 transition-colors tracking-wide">{t('footer.contact')}</Link>
          <Link href="/terms" className="hover:text-teal-400 transition-colors tracking-wide">{t('footer.terms')}</Link>
          <Link href="/privacy" className="hover:text-teal-400 transition-colors tracking-wide">{t('footer.privacy')}</Link>
          <Link href="/login" className="hover:text-teal-400 transition-colors tracking-wide">{t('footer.login')}</Link>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors tracking-wide">
            <Instagram className="h-3.5 w-3.5" aria-hidden="true" />
            Instagram
          </a>
        </div>
        <p>{t('footer.copyright')}</p>
      </footer>
    </div>
  );
}
