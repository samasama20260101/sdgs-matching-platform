'use client';

import Link from 'next/link';
import React, { useEffect, useRef } from 'react';
import { LogoIcon, LogoMark, Logo } from '@/components/icons/Logo';

const TeardropMark = ({ size = 40 }: { size?: number }) => <LogoMark size={size} />;
const TeardropIcon = ({ size = 36 }: { size?: number }) => <LogoIcon size={size} />;

/* ─── フェードイン ─────────────────────── */
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.style.cssText += 'opacity:1;transform:translateY(0)'; },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={{ opacity: 0, transform: 'translateY(28px)',
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════
   PAGE
════════════════════════════════════════ */
export default function StoryPage() {
  return (
    <div className="bg-white text-slate-800 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&family=DM+Serif+Display:ital@0;1&display=swap');
        .serif { font-family: 'Noto Serif JP', serif; }
        .display { font-family: 'DM Serif Display', Georgia, serif; }
        .grad-text { background: linear-gradient(135deg,#0BC5A4,#0A8FD4); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .brand-btn { background: linear-gradient(135deg,#0BC5A4,#0A8FD4); box-shadow: 0 6px 24px rgba(11,197,164,0.35); transition: transform 0.2s, box-shadow 0.2s; }
        .brand-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(11,197,164,0.45); }
        @keyframes float-td { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .float-anim { animation: float-td 4s ease-in-out infinite; }
        @keyframes rr { 0%{transform:scale(0.8);opacity:0.35} 100%{transform:scale(1.15);opacity:0} }
        .rr { position:absolute; border-radius:50%; border:1px solid rgba(11,197,164,0.2); animation:rr 7s ease-out infinite; }
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 sm:px-8 py-4 bg-white/92 backdrop-blur-md border-b border-teal-500/10">
        <Link href="/" className="flex items-center no-underline">
          <Logo variant="default" size="sm" showText={true} />
        </Link>
        <Link href="/" className="text-xs text-slate-400 hover:text-teal-500 transition-colors tracking-wider hidden sm:block">
          ← サービストップへ
        </Link>
        <Link href="/" className="text-xs text-slate-400 hover:text-teal-500 transition-colors sm:hidden">
          ← TOP
        </Link>
      </nav>


      {/* ════ HERO ════ */}
      <section className="bg-slate-900 pt-24 pb-16 px-6 sm:px-10 relative overflow-hidden min-h-[85vh] flex flex-col justify-center">
        {/* 波紋 */}
        <div className="rr w-56 h-56 sm:w-80 sm:h-80" style={{ top:'10%', right:'-60px', animationDelay:'0s' }} />
        <div className="rr w-80 h-80 sm:w-[480px] sm:h-[480px]" style={{ top:'0%', right:'-120px', animationDelay:'2.5s' }} />
        {/* 背景ロゴ */}
        <svg className="absolute right-[-60px] bottom-[-60px] opacity-[0.04]" width="320" height="320" viewBox="0 0 56 56" fill="none">
          <path d="M28 2C28 2 4 26 4 40C4 52.1 15 58 28 58C41 58 52 52.1 52 40C52 26 28 2 28 2Z" fill="white"/>
        </svg>

        <div className="max-w-2xl relative">
          <Reveal>
            <p className="text-[10px] tracking-[5px] text-teal-400 uppercase mb-6 flex items-center gap-3">
              <span className="w-6 h-px bg-teal-400 block" /> Our Story
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="serif text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.45] mb-8">
              ひとりで<br />抱えないで<span className="text-teal-400">。</span><br />誰かが、<br />きっといる。
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-slate-400 text-sm sm:text-base leading-8 tracking-wide max-w-md mb-10">
              社会の隅で、声を上げられずにいる人たちがいる。<br />
              私たちはその声を、必要な人へ届けたかった。
            </p>
          </Reveal>
          {/* 統計 3つ */}
          <Reveal delay={300}>
            <div className="grid grid-cols-3 gap-4 sm:gap-8 border-t border-white/10 pt-8">
              {[
                { num: '700M+', label: 'Extreme poverty\nglobally', src: 'World Bank 2024' },
                { num: '80%',   label: 'Never access\nthe support',    src: 'WHO 2023' },
                { num: '¥0',    label: 'SOS users\nfee',               src: '明日もsamasama' },
              ].map(s => (
                <div key={s.num}>
                  <p className="display text-2xl sm:text-3xl font-black text-teal-400 leading-none mb-1">{s.num}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 leading-5 whitespace-pre-line tracking-wide">{s.label}</p>
                  <p className="text-[9px] text-slate-600 tracking-wider mt-1">{s.src}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>


      {/* ════ WHY ════ */}
      <section className="py-20 sm:py-28 px-6 sm:px-10 max-w-3xl mx-auto">
        <Reveal>
          <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-10 flex items-center gap-3">
            Why we built this <span className="w-8 h-px bg-teal-400 block" />
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="serif text-3xl sm:text-4xl font-black leading-[1.55] mb-10">
            「助けて」が<br />言えない社会に、<br /><span className="grad-text">私たちは気づいた。</span>
          </h2>
        </Reveal>
        {[
          '生活が苦しくなった時、家族関係に悩んだ時、孤立してしまった時——多くの人は誰にも言えずに抱え込みます。「迷惑をかけたくない」「自分だけが弱いのでは」という思いが、声を上げる手を止める。',
          '一方で、支援したいNPO・企業・行政は世界中に何千も存在します。専門的な知識と温かい手を持つ人たちが、助けを必要としている人に出会えないまま時間が過ぎていく。',
          'このミスマッチは、テクノロジーで解決できると確信しました。AIを架け橋として、「明日もsamasama」の開発が始まりました。',
        ].map((t, i) => (
          <Reveal key={i} delay={i * 80}>
            <p className="text-slate-500 text-[15px] leading-9 tracking-wide mb-6">{t}</p>
          </Reveal>
        ))}

        {/* ファウンダーノート */}
        <Reveal delay={200}>
          <div className="bg-slate-900 rounded-2xl p-8 mt-8 relative overflow-hidden">
            <span className="absolute top-0 left-6 text-[100px] text-teal-400/10 leading-none select-none" style={{ fontFamily:'Georgia,serif' }}>"</span>
            <p className="serif text-white/85 text-sm sm:text-base leading-8 tracking-wider relative">
              支援を受けることは、恥でも弱さでもない。人は誰かに支えられながら生きている——それが当たり前の社会をつくりたい。
            </p>
            <p className="text-teal-400 text-[10px] tracking-[4px] uppercase mt-5">Founder's Note</p>
          </div>
        </Reveal>

        {/* SDGsカード */}
        <Reveal delay={280}>
          <div className="rounded-2xl p-8 mt-4 text-white" style={{ background:'linear-gradient(135deg,#0BC5A4,#0A8FD4)' }}>
            <p className="text-white/70 text-[10px] tracking-[4px] uppercase mb-3">Our Approach to SDGs</p>
            <p className="serif text-xl font-bold mb-3">SDGsは、私たちの羅針盤。</p>
            <p className="text-white/80 text-sm leading-7 tracking-wide">
              SOSユーザーはSDGsを知らなくていい。ただ「困っている」と言えばいい。私たちがその内容をSDGsの視点で分類し、最適なサポーターへつなぐ。SDGsは強要するものではなく、支援の精度を上げるための<strong className="text-white">内側の地図</strong>です。
            </p>
          </div>
        </Reveal>
      </section>


      {/* ════ LOGO STORY ════ */}
      <section className="relative overflow-hidden py-20 sm:py-28 px-6 sm:px-10" style={{ background:'#060E1B' }}>
        <style>{`
          @keyframes mark-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          .mark-float { animation: mark-float 4s ease-in-out infinite; filter: drop-shadow(0 0 28px rgba(11,197,164,.55)); }
          @keyframes mark-glow { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.18);opacity:1} }
          @keyframes mark-dash { to { stroke-dashoffset: -14; } }
          @keyframes mark-ray { 0%,100%{opacity:.3} 50%{opacity:.9} }
        `}</style>

        {/* 背景グロー */}
        <div className="absolute inset-0 pointer-events-none" style={{ background:'radial-gradient(ellipse 80% 45% at 50% 0%,rgba(11,197,164,.11) 0%,transparent 65%),radial-gradient(ellipse 55% 35% at 85% 100%,rgba(10,143,212,.09) 0%,transparent 60%)' }} />
        {/* 背景透かしロゴ */}
        <svg className="absolute right-[-90px] bottom-[-90px] opacity-[0.03] pointer-events-none" width="400" height="400" viewBox="0 0 56 56" fill="none">
          <path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill="white"/>
        </svg>

        <div className="max-w-3xl mx-auto relative">
          {/* タグ */}
          <Reveal>
            <p className="text-[10px] tracking-[5px] text-teal-400 uppercase mb-8 flex items-center gap-3 font-mono">
              <span className="w-7 h-px bg-teal-400 block" /> The Mark
            </p>
          </Reveal>

          {/* 見出し */}
          <Reveal delay={80}>
            <h2 className="serif text-3xl sm:text-4xl font-black leading-[1.65] mb-14 text-white">
              涙は、悲しみだけの<br />ものじゃない。<br />
              <span className="grad-text">その一滴に込めた意味。</span>
            </h2>
          </Reveal>

          {/* ロゴショーケース */}
          <Reveal delay={120}>
            <div className="flex flex-col items-center gap-6 mb-20">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-[230px] h-[230px] rounded-full" style={{ background:'radial-gradient(circle,rgba(11,197,164,.28) 0%,transparent 70%)', animation:'mark-glow 3.5s ease-in-out infinite' }} />
                <div className="absolute w-[155px] h-[155px] rounded-full" style={{ background:'radial-gradient(circle,rgba(10,143,212,.18) 0%,transparent 70%)', animation:'mark-glow 3.5s ease-in-out infinite .6s' }} />
                <div className="mark-float relative z-10"><LogoMark size={130} /></div>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <div className="rounded-2xl px-5 py-3 border border-white/10" style={{ background:'rgba(255,255,255,0.96)' }}>
                  <Logo variant="default" size="sm" showText={true} />
                </div>
                <div className="rounded-2xl px-5 py-3 border border-white/10" style={{ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(8px)' }}>
                  <Logo variant="white" size="sm" showText={true} />
                </div>
              </div>
            </div>
          </Reveal>

          {/* タイムライン */}
          {/* 共通グラデーション定義 — IDの重複を防ぐため1箇所のみ */}
          <svg width="0" height="0" style={{ position:'absolute' }}>
            <defs>
              <linearGradient id="tl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0BC5A4"/><stop offset="100%" stopColor="#0A8FD4"/>
              </linearGradient>
              <radialGradient id="tl-glow" cx="50%" cy="72%" r="38%">
                <stop offset="0%" stopColor="white" stopOpacity=".95"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </radialGradient>
            </defs>
          </svg>
          <div className="relative">
            {/* 縦線: デスクトップ=中央, モバイル=左端 */}
            <div className="absolute top-0 bottom-0 w-px left-[30px] sm:left-1/2 sm:-translate-x-1/2"
              style={{ background:'linear-gradient(to bottom,transparent 0%,rgba(11,197,164,.55) 8%,rgba(10,143,212,.55) 92%,transparent 100%)' }} />

            {[
              {
                side: 'L', emoji: '💧', ctag: 'Shape',
                title: '形に込めた意味',
                body: '涙のかたちは、追い詰められた誰かの痛みを表します。その痛みから目を背けないために、まず涙と向き合うことから始めました。',
                svg: (
                  <svg width="72" height="72" viewBox="0 0 56 56" fill="none">
                    <rect width="56" height="56" fill="#0a1628"/>
                    <path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill="url(#tl-grad)" opacity="0.12"/>
                    <path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill="none" stroke="#0BC5A4" strokeWidth="2" strokeDasharray="4 3" style={{ animation:'mark-dash 6s linear infinite' }}/>
                    <line x1="6" y1="20" x2="6" y2="49" stroke="rgba(11,197,164,.4)" strokeWidth="1"/>
                    <line x1="4" y1="20" x2="8" y2="20" stroke="rgba(11,197,164,.4)" strokeWidth="1"/>
                    <line x1="4" y1="49" x2="8" y2="49" stroke="rgba(11,197,164,.4)" strokeWidth="1"/>
                  </svg>
                ),
              },
              {
                side: 'R', emoji: '🌊', ctag: 'Gradient',
                title: 'グラデーションの意味',
                body: 'ティールから深いブルーへ。これは「海」の色。どんな川も最後は海につながるように、困難の中にいる人も必ずどこかへつながっていける。',
                svg: (
                  <svg width="72" height="72" viewBox="0 0 56 56" fill="none">
                    <rect width="56" height="56" fill="#0a1628"/>
                    <path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill="url(#tl-grad)"/>
                    <circle cx="28" cy="40" r="8" fill="white" opacity="0.22"/>
                    <rect x="8" y="49" width="14" height="4" rx="2" fill="#0BC5A4"/>
                    <rect x="25" y="49" width="14" height="4" rx="2" fill="#0A8FD4"/>
                  </svg>
                ),
              },
              {
                side: 'L', emoji: '✨', ctag: 'Inner Light',
                title: '内側の光の意味',
                body: '涙型の底に、うっすらと白い光があります。どんなに暗い状況でも内側に灯は残っている。支援とは、その灯を一緒に育てること。',
                svg: (
                  <svg width="72" height="72" viewBox="0 0 56 56" fill="none">
                    <rect width="56" height="56" fill="#0a1628"/>
                    <path d="M28 5C28 5 9 24 9 37C9 47.5 17.5 52 28 52C38.5 52 47 47.5 47 37C47 24 28 5 28 5Z" fill="url(#tl-grad)" opacity="0.45"/>
                    <circle cx="28" cy="40" r="14" fill="url(#tl-glow)"/>
                    <circle cx="28" cy="40" r="7" fill="white" opacity=".92"/>
                    <line x1="28" y1="24" x2="28" y2="19" stroke="white" strokeWidth="1.5" strokeLinecap="round" style={{ animation:'mark-ray 2s ease-in-out infinite' }}/>
                    <line x1="17" y1="30" x2="13" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
                    <line x1="39" y1="30" x2="43" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
                  </svg>
                ),
              },
              {
                side: 'R', emoji: '🔄', ctag: 'Transformation',
                title: '涙が変わる瞬間',
                body: '悲しみの涙が感謝の涙に変わる瞬間——それがこのプラットフォームの存在意義です。同じ一滴に、ふたつの意味を込めました。',
                svg: (
                  <svg width="72" height="72" viewBox="0 0 56 56" fill="none">
                    <rect width="56" height="56" fill="#0a1628"/>
                    <path d="M14 7C14 7 6 16 6 23C6 28.5 9.5 31 14 31C18.5 31 22 28.5 22 23C22 16 14 7 14 7Z" fill="#334155" opacity=".7"/>
                    <path d="M25 19 L31 19 M28.5 16.5 L31 19 L28.5 21.5" stroke="#0BC5A4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M42 7C42 7 34 16 34 23C34 28.5 37.5 31 42 31C46.5 31 50 28.5 50 23C50 16 42 7 42 7Z" fill="url(#tl-grad)"/>
                    <circle cx="42" cy="25" r="4" fill="white" opacity=".28"/>
                    <text x="4" y="41" fontFamily="monospace" fontSize="5" fill="#64748b">BEFORE</text>
                    <text x="31" y="41" fontFamily="monospace" fontSize="5" fill="#0BC5A4">AFTER</text>
                  </svg>
                ),
              },
            ].map((item, i) => {
              const isL = item.side === 'L';
              const dotStyle: React.CSSProperties = {
                background:'linear-gradient(135deg,#0BC5A4,#0A8FD4)',
                boxShadow:'0 0 0 7px rgba(11,197,164,.1),0 0 0 14px rgba(11,197,164,.05),0 8px 24px rgba(11,197,164,.38)',
              };
              const cardStyle: React.CSSProperties = {
                borderRadius:20, padding:26,
                background:'rgba(255,255,255,.04)',
                border:'1px solid rgba(255,255,255,.09)',
              };
              return (
                <Reveal key={i} delay={i * 80}>
                  <div className="flex items-center mb-10 gap-0">
                    {/* モバイル: ドットを先頭に固定 / デスクトップ: L=カード→ドット→空, R=空→ドット→カード */}
                    {/* ── デスクトップ (sm以上) ── */}
                    <div className="hidden sm:grid w-full" style={{ gridTemplateColumns:'1fr 60px 1fr', alignItems:'center' }}>
                      {isL ? (
                        <>
                          <div style={{ ...cardStyle, marginRight:14, textAlign:'right' }}>
                            <span className="text-[9px] tracking-[3.5px] text-teal-400 font-mono uppercase mb-2 block">{item.ctag}</span>
                            <div className="inline-block rounded-xl overflow-hidden border border-white/10 mb-3">{item.svg}</div>
                            <h4 className="font-bold text-white/90 text-sm mb-2">{item.title}</h4>
                            <p className="text-white/40 text-xs leading-[2] font-sans font-light">{item.body}</p>
                          </div>
                          <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-2xl z-10 justify-self-center flex-shrink-0" style={dotStyle}>{item.emoji}</div>
                          <div />
                        </>
                      ) : (
                        <>
                          <div />
                          <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-2xl z-10 justify-self-center flex-shrink-0" style={dotStyle}>{item.emoji}</div>
                          <div style={{ ...cardStyle, marginLeft:14 }}>
                            <span className="text-[9px] tracking-[3.5px] text-teal-400 font-mono uppercase mb-2 block">{item.ctag}</span>
                            <div className="inline-block rounded-xl overflow-hidden border border-white/10 mb-3">{item.svg}</div>
                            <h4 className="font-bold text-white/90 text-sm mb-2">{item.title}</h4>
                            <p className="text-white/40 text-xs leading-[2] font-sans font-light">{item.body}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {/* ── モバイル (sm未満): ドット左 → カード右 ── */}
                    <div className="flex sm:hidden w-full items-center gap-3 min-w-0">
                      <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-xl flex-shrink-0 z-10" style={dotStyle}>{item.emoji}</div>
                      <div style={{ ...cardStyle, flex:1, minWidth:0, padding:18 }}>
                        <span className="text-[9px] tracking-[3.5px] text-teal-400 font-mono uppercase mb-2 block">{item.ctag}</span>
                        <div className="inline-block rounded-xl overflow-hidden border border-white/10 mb-3">{item.svg}</div>
                        <h4 className="font-bold text-white/90 text-sm mb-2">{item.title}</h4>
                        <p className="text-white/40 text-xs leading-[2] font-sans font-light break-all">{item.body}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>



            {/* ════ VALUES ════ */}
      <section className="py-20 sm:py-28 px-6 sm:px-10 max-w-3xl mx-auto">
        <Reveal>
          <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-6 flex items-center gap-3">
            Our Values <span className="w-8 h-px bg-teal-400 block" />
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="serif text-3xl sm:text-4xl font-black leading-[1.55] mb-12">
            テクノロジーは<br />人を<span className="grad-text">つなぐ</span>ための<br />道具にすぎない。
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { n:'01', title:'尊厳を守る',        body:'相談者の個人情報は、承認するまでサポーターに渡りません。自分のペースで動ける設計です。' },
            { n:'02', title:'対等な関係',        body:'「samasama」という名前には、支援する側・される側という上下関係をなくしたいという思いが込められています。' },
            { n:'03', title:'AIは架け橋',        body:'AIは出会いを促す架け橋です。最後に動くのは人間の温かさと意思。テクノロジーはその補助です。' },
            { n:'04', title:'声なき声を聞く',    body:'少ない言葉でも状況を理解しようとするAI設計。世界中どこからでも、敷居を低く、間口を広く。' },
            { n:'05', title:'持続できる仕組み',  body:'一度きりでなく関係が続く設計。サポーターのモチベーションも守り、持続可能な支援のエコシステムを目指します。' },
            { n:'06', title:'SDGsへの誠実さ',    body:'SDGsは私たちの羅針盤。SOSユーザーには求めません。困りごとをAIが分類し最適な支援者へつなぐ、内側の地図として活用します。' },
          ].map((v, i) => (
            <Reveal key={v.n} delay={i * 50}>
              <div className="border border-slate-200 rounded-2xl p-7 hover:border-teal-400 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <p className="display text-4xl font-black text-slate-100 leading-none mb-3">{v.n}</p>
                <h3 className="serif font-bold text-slate-800 text-base mb-2">{v.title}</h3>
                <p className="text-slate-500 text-xs leading-7 tracking-wide">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>


      {/* ════ MESSAGE ════ */}
      <section className="bg-slate-900 py-20 sm:py-28 px-6 sm:px-10 relative overflow-hidden">
        <svg className="absolute right-[-120px] top-[-120px] opacity-[0.04] pointer-events-none" width="500" height="500" viewBox="0 0 56 56" fill="none">
          <path d="M28 2C28 2 4 26 4 40C4 52.1 15 58 28 58C41 58 52 52.1 52 40C52 26 28 2 28 2Z" fill="white"/>
        </svg>
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <p className="text-[10px] tracking-[5px] text-teal-400 uppercase mb-10 flex items-center justify-center gap-3">
              <span className="w-8 h-px bg-teal-400 block" /> A Message <span className="w-8 h-px bg-teal-400 block" />
            </p>
          </Reveal>
          <Reveal delay={100}>
            <p className="serif text-white/85 text-base sm:text-lg leading-[2.8] tracking-widest mb-12">
              ひとりで抱えきれない問題に向き合うとき、<br />
              答えがわからないままでは、<br />
              <strong className="text-teal-400">明日が来ることが困難だと思う人</strong>が<br />
              きっといるとしたら。<br /><br />
              情報がその答えならば、<br />
              <strong className="text-white">知りたいときに手が届く場所</strong>になければならない。<br /><br />
              答えがあるならば、<br />
              <strong className="text-white">必要とする人のもとに伝わら</strong>なければならない。<br /><br />
              今日も、明日も、変わらずその先も。<br /><br />
              それでは、また明日も、<strong className="text-teal-400">samasama</strong>。
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex justify-center mb-5"><TeardropMark size={32} /></div>
            <p className="text-white/25 text-[10px] tracking-[4px] uppercase">明日もsamasama 開発チーム — 2026</p>
          </Reveal>
        </div>
      </section>


      {/* ════ GLOBAL ════ */}
      <section className="py-20 sm:py-28 px-6 sm:px-10 max-w-3xl mx-auto">
        <Reveal>
          <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-6 flex items-center gap-3">
            Global Context <span className="w-8 h-px bg-teal-400 block" />
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="serif text-2xl sm:text-3xl font-black leading-[1.6] mb-10">
            SDGsが示す課題は、<br /><span className="grad-text">今ここにある現実</span>だ。<br />
            <span className="text-slate-400 text-lg font-normal">だから私たちは、それを支援の指標にする。</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { num:'700M',  label:'極度の貧困人口',    src:'World Bank, 2024' },
            { num:'1B+',   label:'障害を持つ人々',    src:'WHO, 2023' },
            { num:'122M',  label:'強制移動・難民',    src:'UNHCR, 2024' },
            { num:'3.3B',  label:'最低賃金以下で就労', src:'ILO, 2023' },
          ].map((s, i) => (
            <Reveal key={s.num} delay={i * 60}>
              <div className="border border-slate-100 rounded-2xl p-5 hover:border-teal-300 transition-colors">
                <p className="display text-3xl font-black text-teal-500 leading-none mb-2">{s.num}</p>
                <p className="font-bold text-slate-700 text-xs mb-1">{s.label}</p>
                <p className="text-[10px] text-slate-300 tracking-wider">{s.src}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>


      {/* ════ CTA ════ */}
      <section className="py-20 px-6 flex flex-col items-center text-center bg-teal-50">
        <Reveal>
          <div className="float-anim mb-6"><TeardropMark size={44} /></div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="serif text-2xl sm:text-3xl font-black leading-[1.65] mb-4">一歩、踏み出してみませんか。</h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="text-slate-500 text-sm leading-8 mb-10 tracking-wide">
            相談は無料。匿名でも大丈夫。<br />あなたの状況に合ったサポーターを、AIが一緒に探します。
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/signup"
              className="brand-btn inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-full font-bold text-sm tracking-wide no-underline">
              <TeardropMark size={16} /> 無料で相談する
            </Link>
            <Link href="/supporters"
              className="inline-flex items-center justify-center gap-2 text-slate-600 border-2 border-slate-200 px-8 py-4 rounded-full font-bold text-sm tracking-wide hover:border-teal-400 hover:text-teal-600 transition-colors no-underline">
              サポーターを見る →
            </Link>
          </div>
        </Reveal>
      </section>


      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8 px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center">
          <Logo variant="default" size="sm" showText={true} />
        </div>
        <p className="text-xs text-slate-300 tracking-[2px]">© 2026 明日もsamasama. All rights reserved.</p>
        <p className="text-xs text-slate-300 tracking-[2px] uppercase">SDGs Match Platform</p>
      </footer>
    </div>
  );
}
