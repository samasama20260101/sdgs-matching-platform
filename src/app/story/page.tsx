'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/* ── ロゴシンボル（涙型）─────────────────── */
function TeardropMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tm-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0BC5A4" />
          <stop offset="100%" stopColor="#0A8FD4" />
        </linearGradient>
      </defs>
      <path d="M28 6C28 6 10 24 10 36C10 45.9 18.1 50 28 50C37.9 50 46 45.9 46 36C46 24 28 6 28 6Z"
        fill="url(#tm-g)" />
      <circle cx="28" cy="39" r="7" fill="white" opacity="0.22" />
    </svg>
  );
}

function TeardropIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ti-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0BC5A4" />
          <stop offset="100%" stopColor="#0A8FD4" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="14" fill="#0A1628" />
      <path d="M28 7C28 7 11 24 11 36C11 45.4 18.6 49 28 49C37.4 49 45 45.4 45 36C45 24 28 7 28 7Z"
        fill="url(#ti-g)" />
      <circle cx="28" cy="38" r="7" fill="white" opacity="0.2" />
    </svg>
  );
}

/* ── スクロールフェードイン ─────────────────── */
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.style.cssText += 'opacity:1;transform:translateY(0)'; },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(36px)',
        transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════ */
export default function StoryPage() {
  return (
    <div className="bg-white text-slate-800 overflow-x-hidden" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>

      {/* ── グローバルスタイル ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700;900&family=Noto+Sans+JP:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');

        @keyframes float-logo {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }
        @keyframes ripple-ring {
          0%   { transform: scale(0.8); opacity: 0.4; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        .float-anim { animation: float-logo 4s ease-in-out infinite; }
        .ripple-r {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(11,197,164,0.18);
          animation: ripple-ring 7s ease-out infinite;
        }
        .grad-text {
          background: linear-gradient(135deg, #0BC5A4, #0A8FD4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .serif { font-family: 'Noto Serif JP', serif; }
        .display { font-family: 'DM Serif Display', Georgia, serif; }
        .vcard { transition: border-color .3s, transform .3s, box-shadow .3s; }
        .vcard:hover { border-color: #0BC5A4; transform: translateY(-6px); box-shadow: 0 24px 48px rgba(11,197,164,.10); }
        .vcard:hover .vnum { color: #0BC5A4; opacity: .3; }
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 bg-white/90 backdrop-blur-md border-b border-teal-500/10">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <TeardropIcon size={34} />
          <span className="font-bold text-slate-800 text-sm tracking-wide serif">明日も<span className="text-teal-500">sama</span>sama</span>
        </Link>
        <Link href="/" className="text-sm text-slate-400 hover:text-teal-500 transition-colors tracking-wider">
          ← サービストップへ
        </Link>
      </nav>


      {/* ════ HERO ════ */}
      <section className="min-h-screen grid grid-cols-1 lg:grid-cols-2">

        {/* 左ダーク */}
        <div className="relative bg-slate-900 flex flex-col justify-center px-14 pt-32 pb-20 overflow-hidden">
          <div className="ripple-r w-72 h-72" style={{ top: '15%', left: '-80px', animationDelay: '0s' }} />
          <div className="ripple-r w-[480px] h-[480px]" style={{ top: '5%', left: '-170px', animationDelay: '2s' }} />
          <div className="ripple-r w-[680px] h-[680px]" style={{ top: '-5%', left: '-260px', animationDelay: '4s' }} />
          <svg className="absolute right-[-80px] bottom-[-80px] opacity-[0.04]" width="420" height="420" viewBox="0 0 56 56" fill="none">
            <path d="M28 2C28 2 4 26 4 40C4 52.1 15 58 28 58C41 58 52 52.1 52 40C52 26 28 2 28 2Z" fill="white"/>
          </svg>

          <Reveal>
            <p className="text-xs tracking-[5px] text-teal-400 uppercase mb-8 flex items-center gap-3">
              <span className="w-8 h-px bg-teal-400 block" /> Our Story
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="serif text-5xl lg:text-6xl font-black text-white leading-[1.5] tracking-tight mb-10">
              ひとりで<br />抱えないで<span className="text-teal-400">。</span><br />誰かが、<br />きっといる。
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="text-slate-400 text-sm leading-9 tracking-wider max-w-sm">
              社会の隅で、声を上げられずにいる人たちがいる。<br />私たちはその声を、必要な人へ届けたかった。
            </p>
          </Reveal>
        </div>

        {/* 右ライト */}
        <div className="bg-slate-50 flex flex-col justify-center px-14 pt-32 pb-20">
          <Reveal>
            <blockquote className="mb-12">
              <p className="display text-2xl lg:text-3xl leading-relaxed text-slate-700 mb-5">
                "Not just the same —<br />
                <em>a little better</em><br />
                than yesterday."
              </p>
              <p className="text-slate-400 text-sm leading-9 tracking-widest serif">
                昨日より、今日より、明日が少しだけ良くなる。<br />
                その積み重ねが、人生を変えていく。
              </p>
            </blockquote>
          </Reveal>
          <Reveal delay={150}>
            <div className="grid grid-cols-3 gap-5">
              {[
                { num: '700M+', label: 'People in extreme\npoverty globally', src: 'World Bank 2024' },
                { num: '80%',   label: 'Never access the\nsupport they need',  src: 'WHO 2023' },
                { num: '0',     label: 'Cost for SOS users\non this platform',   src: '明日もsamasama' },
              ].map(s => (
                <div key={s.num}>
                  <p className="display text-4xl font-black text-teal-500 leading-none mb-2">{s.num}</p>
                  <p className="text-xs text-slate-500 leading-5 tracking-wide whitespace-pre-line">{s.label}</p>
                  <p className="text-[10px] text-slate-300 tracking-wider mt-1">{s.src}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>


      {/* ════ WHY WE BUILT THIS ════ */}
      <section className="py-40 px-8 max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-16 flex items-center gap-3">
            Why we built this <span className="w-12 h-px bg-teal-400 block" />
          </p>
        </Reveal>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
          <div>
            <Reveal>
              <h2 className="serif text-4xl lg:text-5xl font-black leading-[1.55] tracking-tight mb-12">
                「助けて」が<br />言えない社会に、<br /><span className="grad-text">私たちは気づいた。</span>
              </h2>
            </Reveal>
            {[
              '生活が苦しくなった時、家族関係に悩んだ時、孤立してしまった時——多くの人は誰にも言えずに抱え込みます。「迷惑をかけたくない」「自分だけが弱いのでは」という思いが、声を上げる手を止める。',
              '一方で、支援したいNPO・企業・行政は世界中に何千も存在します。専門的な知識と温かい手を持つ人たちが、助けを必要としている人に出会えないまま時間が過ぎていく。',
              'このミスマッチは、テクノロジーで解決できると確信しました。人と人をつなぐ架け橋として、AIを活用したマッチングプラットフォーム「明日もsamasama」の開発が始まりました。',
            ].map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <p className="text-slate-500 text-[15px] leading-9 tracking-wide mb-7">{t}</p>
              </Reveal>
            ))}
          </div>
          <div className="sticky top-28 flex flex-col gap-6">
            <Reveal>
              <div className="bg-slate-900 rounded-3xl p-12 relative overflow-hidden">
                <span className="absolute top-2 left-8 text-[120px] text-teal-400/10 leading-none select-none" style={{ fontFamily: 'Georgia, serif' }}>"</span>
                <p className="serif text-white/85 text-base leading-9 tracking-wider relative">
                  支援を受けることは、恥でも弱さでもない。人は誰かに支えられながら生きている——それが当たり前の社会をつくりたい。
                </p>
                <p className="text-teal-400 text-[10px] tracking-[4px] uppercase mt-6">Founder's Note</p>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="rounded-3xl p-10 text-white" style={{ background: 'linear-gradient(135deg,#0BC5A4,#0A8FD4)' }}>
                <p className="text-white/70 text-[10px] tracking-[4px] uppercase mb-4">Our Approach to SDGs</p>
                <p className="display text-2xl font-black leading-tight mb-4">SDGsは、<br />私たちの羅針盤。</p>
                <p className="text-white/80 text-sm leading-7 tracking-wide">
                  SOSユーザーは、SDGsを知らなくていい。ただ「困っている」と言えばいい。<br /><br />
                  私たちがその内容をSDGsの17目標に照らして分類し、最も適切なサポーターへつなぐ。SDGsは強要するものではなく、支援の精度を上げるための<strong className="text-white">内側の地図</strong>です。
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>


      {/* ════ LOGO STORY ════ */}
      <section className="bg-slate-50 py-40 px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-16 flex items-center gap-3">
              The Mark <span className="w-12 h-px bg-teal-400 block" />
            </p>
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">

            {/* 左：ロゴビジュアル */}
            <Reveal className="flex flex-col items-center gap-14">
              <div className="float-anim">
                <svg width="180" height="210" viewBox="0 0 56 62" fill="none" aria-label="明日もsamasama ロゴマーク">
                  <defs>
                    <linearGradient id="td-hero" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0BC5A4" />
                      <stop offset="100%" stopColor="#0A8FD4" />
                    </linearGradient>
                    <filter id="glow-h"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <path d="M28 4C28 4 6 26 6 40C6 52.1 16.1 57 28 57C39.9 57 50 52.1 50 40C50 26 28 4 28 4Z"
                    fill="url(#td-hero)" filter="url(#glow-h)" />
                  <circle cx="28" cy="43" r="10" fill="white" opacity="0.18" />
                </svg>
              </div>
              {/* サイズプレビュー */}
              <div className="flex items-end gap-5">
                {[64, 40, 24, 16].map(sz => (
                  <div key={sz} className="flex flex-col items-center gap-2">
                    <TeardropIcon size={sz} />
                    <span className="text-[9px] text-slate-400 tracking-widest">{sz}px</span>
                  </div>
                ))}
              </div>
              {/* ライト／ダーク比較 */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="bg-white rounded-2xl px-6 py-4 shadow-sm flex items-center gap-3 border border-slate-100">
                  <TeardropMark size={26} />
                  <div>
                    <p className="serif text-sm font-bold text-slate-800 leading-none">明日も<span className="text-teal-500">sama</span>sama</p>
                    <p className="text-[8px] text-slate-400 tracking-[3px] mt-1">SDGs MATCH</p>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-2xl px-6 py-4 flex items-center gap-3">
                  <TeardropMark size={26} />
                  <div>
                    <p className="serif text-sm font-bold text-white leading-none">明日も<span className="text-teal-400">sama</span>sama</p>
                    <p className="text-[8px] text-slate-500 tracking-[3px] mt-1">SDGs MATCH</p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* 右：テキスト */}
            <div>
              <Reveal>
                <h2 className="serif text-4xl lg:text-5xl font-black leading-[1.6] tracking-tight mb-14">
                  涙は、<br />悲しみだけの<br />ものじゃない。
                </h2>
              </Reveal>
              <div className="flex flex-col gap-10">
                {[
                  { icon: '💧', title: '形に込めた意味',
                    body: 'このマークは、涙のかたちをしています。追い詰められて泣くしかない夜が、世界中に何億もある。その痛みから目を背けないために——まず涙と向き合うことから始めました。' },
                  { icon: '🌊', title: 'グラデーションの意味',
                    body: 'ティールから深いブルーへ。これは「海」の色です。どんな川も、最後は海につながる。困難の中にいる人も、必ずどこかへつながっていけると信じています。' },
                  { icon: '✨', title: '内側の光の意味',
                    body: '涙型の底に、うっすらと白い光があります。どんなに暗い状況でも、内側に灯は残っている。支援とは、その灯を一緒に育てることだと私たちは考えます。' },
                  { icon: '🔄', title: '涙が変わる瞬間',
                    body: '悲しみの涙が、感謝の涙に変わる瞬間——それこそがこのプラットフォームの存在意義です。同じ一滴の涙に、ふたつの意味を込めました。' },
                ].map((item, i) => (
                  <Reveal key={i} delay={i * 80}>
                    <div className="flex gap-5 items-start">
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-lg"
                        style={{ background: 'linear-gradient(135deg,#0BC5A4,#0A8FD4)' }}>
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-[15px] mb-2 tracking-wide">{item.title}</h4>
                        <p className="text-slate-500 text-[13px] leading-8 tracking-wide">{item.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ════ OUR VALUES ════ */}
      <section className="py-40 px-8 max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-6 flex items-center gap-3">
            Our Values <span className="w-12 h-px bg-teal-400 block" />
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="serif text-4xl lg:text-5xl font-black leading-[1.55] tracking-tight mb-20 max-w-3xl">
            テクノロジーは<br />人を<span className="grad-text">つなぐ</span>ための<br />道具にすぎない。
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {[
            { n:'01', title:'尊厳を守る',      body:'支援を受けることを、恥だと感じさせない。相談者の個人情報は、自分が承認するまでサポーターに渡りません。自分のペースで、自分の意思で動ける設計です。' },
            { n:'02', title:'対等な関係',      body:'支援する側・される側という上下関係ではなく、同じ社会で生きる者同士として出会う場所。「samasama（さまさま）」という名前には、対等という思いが込められています。' },
            { n:'03', title:'AIは架け橋',      body:'AIは支援の決定をしません。あくまで出会いを促す架け橋です。最後に動くのは、人間の温かさと意思。テクノロジーはその補助をするだけです。' },
            { n:'04', title:'声なき声を聞く',  body:'「助けて」と言葉にできない人のために、少ない言葉でも状況を理解しようとするAI設計。世界中どこからでも、敷居を低く、間口を広く。' },
            { n:'05', title:'継続できる仕組み', body:'一度きりの支援ではなく、関係が続く設計。サポーターのモチベーションも守ることで、持続可能な支援のエコシステムを目指します。' },
            { n:'06', title:'SDGsへの誠実さ',  body:'SDGsは私たちの羅針盤であり、SOSユーザーに求めるものではありません。困りごとをAIがSDGsの視点で分類し、最適な支援者へつなぐ——ユーザーはただ「助けてほしい」と言うだけでいい。' },
          ].map((v, i) => (
            <Reveal key={v.n} delay={i * 60}>
              <div className="vcard border border-slate-200 rounded-2xl p-10 h-full">
                <p className="vnum display text-6xl font-black text-slate-100 leading-none mb-5 transition-colors duration-300">{v.n}</p>
                <h3 className="serif font-bold text-slate-800 text-lg mb-4 tracking-wide">{v.title}</h3>
                <p className="text-slate-500 text-[13px] leading-8 tracking-wide">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>


      {/* ════ MESSAGE ════ */}
      <section className="bg-slate-900 py-40 px-8 relative overflow-hidden">
        <svg className="absolute right-[-180px] top-[-180px] opacity-[0.035] pointer-events-none" width="700" height="700" viewBox="0 0 56 56" fill="none">
          <path d="M28 2C28 2 4 26 4 40C4 52.1 15 58 28 58C41 58 52 52.1 52 40C52 26 28 2 28 2Z" fill="white"/>
        </svg>
        <div className="max-w-3xl mx-auto text-center relative">
          <Reveal>
            <p className="text-[10px] tracking-[5px] text-teal-400 uppercase mb-14 flex items-center justify-center gap-3">
              <span className="w-10 h-px bg-teal-400 block" /> A Message <span className="w-10 h-px bg-teal-400 block" />
            </p>
          </Reveal>
          <Reveal delay={100}>
            <p className="serif text-white/85 text-lg lg:text-[22px] leading-[2.8] tracking-widest mb-16">
              私たちが恐れるのは、<br />
              誰かが<strong className="text-teal-400">「もう明日はいらない」</strong>と<br />
              思ってしまう瞬間です。<br /><br />

              このサービスの名前「明日もsamasama」は、<br />
              今どんなに辛くても、<strong className="text-teal-400">明日はきっと今日より少しだけ良くなる</strong>、<br />
              という祈りが込められています。<br /><br />

              昨日より今日、今日より明日——<br />
              小さな一歩が、人生を変えることを私たちは信じています。<br /><br />

              その一歩を支えるために、<br />
              私たちは今日も、このプラットフォームを育てています。
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex justify-center mb-6">
              <TeardropMark size={36} />
            </div>
            <p className="text-white/25 text-[11px] tracking-[5px] uppercase">
              明日もsamasama 開発チーム — 2026
            </p>
          </Reveal>
        </div>
      </section>


      {/* ════ GLOBAL CONTEXT ════ */}
      <section className="py-40 px-8 max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[10px] tracking-[5px] text-teal-500 uppercase mb-16 flex items-center gap-3">
            Global Context <span className="w-12 h-px bg-teal-400 block" />
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="serif text-3xl lg:text-4xl font-black leading-[1.6] tracking-tight mb-16 max-w-2xl">
            SDGsが示す課題は、<br />
            <span className="grad-text">今ここにある現実</span>だ。<br />
            <span className="text-slate-400 text-xl lg:text-2xl font-normal">だから私たちは、それを支援の指標にする。</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { num:'700M',  label:'極度の貧困人口',    detail:'1日2.15ドル未満で生活する人々', src:'World Bank, 2024' },
            { num:'1B+',   label:'障害を持つ人々',    detail:'支援へのアクセスが著しく制限される', src:'WHO, 2023' },
            { num:'122M',  label:'強制移動・難民',    detail:'故郷を追われ支援を必要とする人々', src:'UNHCR, 2024' },
            { num:'3.3B',  label:'最低賃金以下で就労', detail:'世界の労働人口の約半数', src:'ILO, 2023' },
          ].map((s, i) => (
            <Reveal key={s.num} delay={i * 70}>
              <div className="border border-slate-100 rounded-2xl p-8 hover:border-teal-300 transition-colors h-full">
                <p className="display text-4xl font-black text-teal-500 leading-none mb-3">{s.num}</p>
                <p className="font-bold text-slate-800 text-sm mb-2 tracking-wide">{s.label}</p>
                <p className="text-slate-400 text-[12px] leading-6 mb-3">{s.detail}</p>
                <p className="text-[10px] text-slate-300 tracking-wider">{s.src}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>


      {/* ════ CTA ════ */}
      <section className="py-32 px-8 flex flex-col items-center text-center">
        <Reveal>
          <div className="float-anim mb-8"><TeardropMark size={52} /></div>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="serif text-3xl lg:text-4xl font-black leading-[1.65] tracking-tight mb-6">
            一歩、踏み出してみませんか。
          </h2>
        </Reveal>
        <Reveal delay={180}>
          <p className="text-slate-500 text-[15px] leading-9 mb-12 tracking-wide">
            相談は無料。匿名でも大丈夫。<br />
            あなたの状況に合ったサポーターを、AIが一緒に探します。
          </p>
        </Reveal>
        <Reveal delay={250}>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/signup"
              className="inline-flex items-center gap-3 text-white px-10 py-5 rounded-full font-bold text-[15px] tracking-wide transition-all hover:-translate-y-1 no-underline"
              style={{ background:'linear-gradient(135deg,#0BC5A4,#0A8FD4)', boxShadow:'0 8px 32px rgba(11,197,164,0.35)' }}>
              <TeardropMark size={18} />
              無料で相談する
            </Link>
            <Link href="/supporters"
              className="inline-flex items-center gap-2 text-slate-600 border-2 border-slate-200 px-10 py-5 rounded-full font-bold text-[15px] tracking-wide transition-all hover:border-teal-400 hover:text-teal-600 no-underline">
              サポーターを見る →
            </Link>
          </div>
        </Reveal>
      </section>


      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-10 px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <TeardropIcon size={28} />
          <span className="serif text-sm text-slate-400 tracking-wide">明日もsamasama</span>
        </div>
        <p className="text-xs text-slate-300 tracking-[3px]">© 2026 明日もsamasama. All rights reserved.</p>
        <p className="text-xs text-slate-300 tracking-[3px] uppercase">SDGs Match Platform</p>
      </footer>

    </div>
  );
}
