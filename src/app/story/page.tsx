'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/* ─── ロゴシンボル ─────────────────────── */
function TeardropMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tm" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0BC5A4" />
          <stop offset="100%" stopColor="#0A8FD4" />
        </linearGradient>
      </defs>
      <path d="M28 6C28 6 10 24 10 36C10 45.9 18.1 50 28 50C37.9 50 46 45.9 46 36C46 24 28 6 28 6Z" fill="url(#tm)" />
      <circle cx="28" cy="39" r="7" fill="white" opacity="0.22" />
    </svg>
  );
}

function TeardropIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ti" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0BC5A4" />
          <stop offset="100%" stopColor="#0A8FD4" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="14" fill="#0A1628" />
      <path d="M28 7C28 7 11 24 11 36C11 45.4 18.6 49 28 49C37.4 49 45 45.4 45 36C45 24 28 7 28 7Z" fill="url(#ti)" />
      <circle cx="28" cy="38" r="7" fill="white" opacity="0.2" />
    </svg>
  );
}

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
        <Link href="/" className="flex items-center gap-2 no-underline">
          <TeardropIcon size={30} />
          <span className="serif font-bold text-slate-800 text-sm">明日も<span className="text-teal-500">sama</span>sama</span>
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
      <section className="bg-slate-50 py-20 sm:py-28 px-6 sm:px-10">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-10 flex items-center gap-3">
              The Mark <span className="w-8 h-px bg-teal-400 block" />
            </p>
          </Reveal>

          {/* ロゴ大 + サイズプレビュー */}
          <Reveal>
            <div className="flex flex-col items-center gap-8 mb-14">
              <div className="float-anim">
                <svg width="120" height="136" viewBox="0 0 56 62" fill="none" aria-label="明日もsamasama ロゴマーク">
                  <defs>
                    <linearGradient id="td-s" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0BC5A4" />
                      <stop offset="100%" stopColor="#0A8FD4" />
                    </linearGradient>
                    <filter id="glow-s"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <path d="M28 4C28 4 6 26 6 40C6 52.1 16.1 57 28 57C39.9 57 50 52.1 50 40C50 26 28 4 28 4Z" fill="url(#td-s)" filter="url(#glow-s)" />
                  <circle cx="28" cy="43" r="10" fill="white" opacity="0.18" />
                </svg>
              </div>
              {/* サイズ比較 */}
              <div className="flex items-end gap-4">
                {[48, 32, 20, 14].map(sz => (
                  <div key={sz} className="flex flex-col items-center gap-2">
                    <TeardropIcon size={sz} />
                    <span className="text-[9px] text-slate-400 tracking-widest">{sz}px</span>
                  </div>
                ))}
              </div>
              {/* ライト／ダーク比較 */}
              <div className="flex flex-wrap justify-center gap-3">
                <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-2 border border-slate-100">
                  <TeardropMark size={22} />
                  <div>
                    <p className="serif text-xs font-bold text-slate-800 leading-none">明日も<span className="text-teal-500">sama</span>sama</p>
                    <p className="text-[8px] text-slate-400 tracking-[3px] mt-1">SDGs MATCH</p>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-xl px-4 py-3 flex items-center gap-2">
                  <TeardropMark size={22} />
                  <div>
                    <p className="serif text-xs font-bold text-white leading-none">明日も<span className="text-teal-400">sama</span>sama</p>
                    <p className="text-[8px] text-slate-500 tracking-[3px] mt-1">SDGs MATCH</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ロゴの意味 */}
          <Reveal delay={80}>
            <h2 className="serif text-3xl sm:text-4xl font-black leading-[1.6] mb-10">
              涙は、悲しみだけの<br />ものじゃない。
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon:'💧', title:'形に込めた意味',
                body:'涙のかたちは、追い詰められた誰かの痛みを表します。その痛みから目を背けないために、まず涙と向き合うことから始めました。' },
              { icon:'🌊', title:'グラデーションの意味',
                body:'ティールから深いブルーへ。これは「海」の色。どんな川も最後は海につながるように、困難の中にいる人も必ずどこかへつながっていける。' },
              { icon:'✨', title:'内側の光の意味',
                body:'涙型の底に、うっすらと白い光があります。どんなに暗い状況でも内側に灯は残っている。支援とは、その灯を一緒に育てること。' },
              { icon:'🔄', title:'涙が変わる瞬間',
                body:'悲しみの涙が感謝の涙に変わる瞬間——それがこのプラットフォームの存在意義です。同じ一滴に、ふたつの意味を込めました。' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="flex gap-4 items-start bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
                    style={{ background:'linear-gradient(135deg,#0BC5A4,#0A8FD4)' }}>
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1 tracking-wide">{item.title}</h4>
                    <p className="text-slate-500 text-xs leading-7 tracking-wide">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
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
              私たちが恐れるのは、<br />
              誰かが<strong className="text-teal-400">「もう明日はいらない」</strong>と<br />
              思ってしまう瞬間です。<br /><br />
              「明日もsamasama」は、<br />
              今どんなに辛くても、<strong className="text-teal-400">明日はきっと今日より少しだけ良くなる</strong>、<br />
              という祈りが込められています。<br /><br />
              昨日より今日、今日より明日——<br />
              小さな一歩が、人生を変えることを<br />
              私たちは信じています。
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
        <div className="flex items-center gap-2">
          <TeardropIcon size={24} />
          <span className="serif text-xs text-slate-400">明日もsamasama</span>
        </div>
        <p className="text-xs text-slate-300 tracking-[2px]">© 2026 明日もsamasama. All rights reserved.</p>
        <p className="text-xs text-slate-300 tracking-[2px] uppercase">SDGs Match Platform</p>
      </footer>
    </div>
  );
}
