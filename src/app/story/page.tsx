// src/app/story/page.tsx
// 私たちの思い — ストーリーページ
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '私たちの思い | 明日もsamasama',
  description: 'なぜ私たちはこのサービスをつくったのか。ロゴに込めた思い、世界の現実、そして私たちが信じること。',
  openGraph: {
    title: '私たちの思い | 明日もsamasama',
    description: 'なぜ私たちはこのサービスをつくったのか。ロゴに込めた思い、世界の現実、そして私たちが信じること。',
    images: [{ url: '/og-image.png' }],
  },
}

export default function StoryPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;600;700&family=DM+Serif+Display:ital@0;1&display=swap');

        .story-page {
          font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
          background: #fff;
          color: #1a2535;
          overflow-x: hidden;
        }

        /* NAV */
        .story-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          background: rgba(255,255,255,0.93);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(11,197,164,0.1);
        }
        .story-nav-logo {
          display: flex; align-items: center; gap: 12px;
          text-decoration: none;
        }
        .story-nav-name {
          font-family: 'Noto Serif JP', serif;
          font-size: 15px; font-weight: 700; color: #1a2535;
          letter-spacing: 0.02em;
        }
        .story-nav-name span { color: #0BC5A4; }
        .story-nav-link {
          font-size: 12px; color: #94A3B8; text-decoration: none;
          letter-spacing: 0.08em; transition: color 0.2s;
        }
        .story-nav-link:hover { color: #0BC5A4; }

        /* HERO */
        .story-hero {
          min-height: 100vh;
          display: grid; grid-template-columns: 1fr 1fr;
        }
        .story-hero-l {
          background: #0A1628;
          display: flex; flex-direction: column; justify-content: center;
          padding: 140px 72px 80px;
          position: relative; overflow: hidden;
        }
        .ripple {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(11,197,164,0.12);
          animation: ripple-anim 7s ease-out infinite;
        }
        .r1 { width: 320px; height: 320px; top: 15%; left: -100px; animation-delay: 0s; }
        .r2 { width: 560px; height: 560px; top: 5%; left: -200px; animation-delay: 2s; }
        .r3 { width: 800px; height: 800px; top: -5%; left: -300px; animation-delay: 4s; }
        @keyframes ripple-anim {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        .hero-eyebrow {
          font-size: 10px; letter-spacing: 5px; color: #0BC5A4;
          text-transform: uppercase; margin-bottom: 28px; position: relative;
          display: flex; align-items: center; gap: 12px;
        }
        .hero-eyebrow::before {
          content: ''; display: block; width: 32px; height: 1px; background: #0BC5A4;
        }
        .hero-h1 {
          font-family: 'Noto Serif JP', serif;
          font-size: clamp(34px, 3.5vw, 54px);
          font-weight: 700; color: #fff;
          line-height: 1.65; letter-spacing: 0.03em;
          margin-bottom: 36px; position: relative;
        }
        .hero-h1 em { font-style: normal; color: #0BC5A4; }
        .hero-sub {
          font-size: 14px; color: rgba(255,255,255,0.45);
          line-height: 2.1; letter-spacing: 0.05em;
          max-width: 360px; position: relative;
        }
        .hero-bg-drop {
          position: absolute; right: -80px; bottom: -100px; opacity: 0.04; pointer-events: none;
        }

        .story-hero-r {
          background: #F4F7F6;
          display: flex; flex-direction: column; justify-content: center;
          padding: 140px 72px 80px;
        }
        .hero-quote {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(20px, 2.2vw, 30px);
          color: #1a2535; line-height: 1.7; margin-bottom: 48px;
        }
        .hero-quote-ja {
          display: block; font-family: 'Noto Serif JP', serif;
          font-size: 0.6em; color: #94A3B8; margin-top: 10px; font-weight: 300;
        }
        .hero-stats { display: flex; gap: 40px; flex-wrap: wrap; }
        .stat-num {
          font-family: 'DM Serif Display', serif;
          font-size: 40px; color: #0BC5A4; line-height: 1; margin-bottom: 6px;
        }
        .stat-lbl { font-size: 10px; color: #94A3B8; letter-spacing: 2px; line-height: 1.6; }

        /* SECTIONS */
        .story-section {
          padding: 140px 72px;
          max-width: 1100px; margin: 0 auto;
        }
        .section-tag {
          display: inline-flex; align-items: center; gap: 12px;
          font-size: 10px; letter-spacing: 5px; color: #0BC5A4;
          text-transform: uppercase; margin-bottom: 64px;
        }
        .section-tag::after {
          content: ''; display: block; width: 48px; height: 1px; background: #0BC5A4;
        }

        /* WHY WE BUILT */
        .why-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 96px; align-items: start;
        }
        .why-h2 {
          font-family: 'Noto Serif JP', serif;
          font-size: clamp(26px, 2.8vw, 40px);
          font-weight: 700; line-height: 1.65; letter-spacing: 0.02em;
          color: #1a2535; margin-bottom: 40px;
        }
        .why-h2 em {
          font-style: normal;
          background: linear-gradient(135deg, #0BC5A4, #0A8FD4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .why-p {
          font-size: 15px; line-height: 2.3; color: #3d4f63;
          margin-bottom: 28px; letter-spacing: 0.04em;
        }
        .quote-card {
          background: #0A1628; border-radius: 24px; padding: 48px 44px;
          margin-bottom: 20px; position: relative; overflow: hidden;
        }
        .quote-card::before {
          content: '\201C'; position: absolute; top: -12px; left: 28px;
          font-size: 120px; color: #0BC5A4; opacity: 0.12;
          font-family: Georgia, serif; line-height: 1;
        }
        .quote-card p {
          font-family: 'Noto Serif JP', serif;
          font-size: 15px; line-height: 2.1; color: rgba(255,255,255,0.82);
          letter-spacing: 0.06em; position: relative;
        }
        .quote-author {
          margin-top: 20px; font-size: 10px;
          color: #0BC5A4; letter-spacing: 4px; text-transform: uppercase;
        }
        .data-card {
          background: linear-gradient(135deg, #0BC5A4, #0A8FD4);
          border-radius: 24px; padding: 40px 44px;
        }
        .data-card p { font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.9; letter-spacing: 0.04em; }
        .data-big { font-family: 'DM Serif Display', serif; font-size: 52px; color: #fff; line-height: 1; margin: 10px 0 4px; }
        .data-src { font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 3px; margin-bottom: 16px; }

        /* LOGO STORY */
        .logo-section { background: #F4F7F6; padding: 140px 72px; }
        .logo-inner { max-width: 1100px; margin: 0 auto; }
        .logo-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 120px; align-items: center; }
        .logo-visual { display: flex; flex-direction: column; align-items: center; gap: 48px; }
        .drop-float { animation: float-drop 4s ease-in-out infinite; }
        @keyframes float-drop {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        .size-row { display: flex; align-items: flex-end; gap: 20px; }
        .size-item { text-align: center; }
        .size-lbl { font-size: 9px; color: #94A3B8; letter-spacing: 2px; margin-top: 6px; }
        .logo-h2 {
          font-family: 'Noto Serif JP', serif;
          font-size: clamp(24px, 2.6vw, 36px);
          font-weight: 700; line-height: 1.7; color: #1a2535; margin-bottom: 48px;
          letter-spacing: 0.02em;
        }
        .meaning-list { list-style: none; display: flex; flex-direction: column; gap: 32px; }
        .meaning-item { display: flex; gap: 20px; align-items: flex-start; }
        .meaning-icon {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, #0BC5A4, #0A8FD4);
          display: flex; align-items: center; justify-content: center; font-size: 17px;
        }
        .meaning-h4 { font-family: 'Noto Serif JP', serif; font-size: 15px; font-weight: 600; color: #1a2535; margin-bottom: 6px; }
        .meaning-p { font-size: 13px; color: #6B7A8D; line-height: 1.95; letter-spacing: 0.04em; }

        /* VALUES */
        .values-h2 {
          font-family: 'Noto Serif JP', serif;
          font-size: clamp(28px, 3.2vw, 48px);
          font-weight: 700; line-height: 1.6; letter-spacing: 0.02em;
          color: #1a2535; margin-bottom: 80px; max-width: 780px;
        }
        .values-h2 em { font-style: normal; color: #0BC5A4; }
        .values-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 28px; }
        .val-card {
          padding: 44px 36px; border: 1px solid #E2EAE8; border-radius: 20px;
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
        }
        .val-card:hover { border-color: #0BC5A4; transform: translateY(-5px); box-shadow: 0 20px 40px rgba(11,197,164,0.1); }
        .val-num { font-family: 'DM Serif Display', serif; font-size: 52px; color: #E2EAE8; line-height: 1; margin-bottom: 18px; transition: color 0.3s; }
        .val-card:hover .val-num { color: #0BC5A4; opacity: 0.35; }
        .val-h3 { font-family: 'Noto Serif JP', serif; font-size: 17px; font-weight: 600; color: #1a2535; margin-bottom: 14px; letter-spacing: 0.04em; }
        .val-p { font-size: 13px; color: #6B7A8D; line-height: 2.1; letter-spacing: 0.04em; }

        /* MESSAGE */
        .message-sec {
          background: #0A1628; padding: 160px 72px;
          position: relative; overflow: hidden;
        }
        .msg-bg { position: absolute; right: -200px; top: -200px; opacity: 0.03; pointer-events: none; }
        .msg-inner { max-width: 760px; margin: 0 auto; text-align: center; position: relative; }
        .msg-tag {
          font-size: 10px; letter-spacing: 5px; color: #0BC5A4;
          text-transform: uppercase; margin-bottom: 56px; display: block;
        }
        .msg-body {
          font-family: 'Noto Serif JP', serif;
          font-size: clamp(16px, 1.8vw, 21px);
          color: rgba(255,255,255,0.82); line-height: 2.6;
          letter-spacing: 0.07em; margin-bottom: 64px;
        }
        .msg-body strong { color: #0BC5A4; font-weight: 600; }
        .msg-sign { font-size: 11px; color: rgba(255,255,255,0.25); letter-spacing: 4px; text-transform: uppercase; }

        /* CTA */
        .cta-sec { padding: 120px 72px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .cta-h2 { font-family: 'Noto Serif JP', serif; font-size: clamp(26px, 3vw, 40px); font-weight: 700; color: #1a2535; margin-bottom: 18px; line-height: 1.6; }
        .cta-p { font-size: 15px; color: #6B7A8D; line-height: 2; margin-bottom: 48px; }
        .cta-btn {
          display: inline-flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, #0BC5A4, #0A8FD4);
          color: #fff; text-decoration: none;
          padding: 18px 52px; border-radius: 60px;
          font-size: 15px; font-weight: 500; letter-spacing: 0.05em;
          box-shadow: 0 8px 32px rgba(11,197,164,0.35);
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .cta-btn:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(11,197,164,0.45); }

        /* FOOTER */
        .story-footer {
          border-top: 1px solid #E2EAE8; padding: 36px 72px;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 16px;
        }
        .footer-copy { font-size: 12px; color: #94A3B8; letter-spacing: 1px; }

        @media (max-width: 900px) {
          .story-nav { padding: 14px 20px; }
          .story-hero, .why-grid, .logo-grid, .values-grid { grid-template-columns: 1fr; }
          .story-hero-l, .story-hero-r { padding: 120px 28px 60px; }
          .story-section, .logo-section, .message-sec, .cta-sec, .story-footer { padding-left: 24px; padding-right: 24px; }
        }
      `}</style>

      <div className="story-page">

        {/* NAV */}
        <nav className="story-nav">
          <Link href="/" className="story-nav-logo">
            <svg width="30" height="30" viewBox="0 0 56 56" fill="none">
              <defs>
                <linearGradient id="sn-g" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0BC5A4"/>
                  <stop offset="100%" stopColor="#0A8FD4"/>
                </linearGradient>
              </defs>
              <rect width="56" height="56" rx="14" fill="#0A1628"/>
              <path d="M28 6C28 6 10 24 10 36C10 45.9 18.1 50 28 50C37.9 50 46 45.9 46 36C46 24 28 6 28 6Z" fill="url(#sn-g)"/>
              <circle cx="28" cy="38" r="8" fill="white" opacity="0.2"/>
            </svg>
            <span className="story-nav-name">明日も<span>sama</span>sama</span>
          </Link>
          <Link href="/" className="story-nav-link">← サービストップへ</Link>
        </nav>

        {/* HERO */}
        <section className="story-hero">
          <div className="story-hero-l">
            <div className="ripple r1"/>
            <div className="ripple r2"/>
            <div className="ripple r3"/>
            <p className="hero-eyebrow">Our Story</p>
            <h1 className="hero-h1">
              ひとりで<br/>
              抱えないで<em>。</em><br/>
              誰かが、<br/>
              きっといる。
            </h1>
            <p className="hero-sub">
              社会の片隅で、声を上げられずにいる人たちがいる。<br/>
              私たちはその声を、必要な人へ届けたかった。
            </p>
            <svg className="hero-bg-drop" width="480" height="480" viewBox="0 0 56 56" fill="none">
              <path d="M28 2C28 2 4 26 4 40C4 52.1 15 58 28 58C41 58 52 52.1 52 40C52 26 28 2 28 2Z" fill="white"/>
            </svg>
          </div>

          <div className="story-hero-r">
            <div className="hero-quote">
              &ldquo;Tomorrow will be<br/>just the same —<br/>and that&rsquo;s enough.&rdquo;
              <span className="hero-quote-ja">明日もsamasama。それでいい、という気持ちから。</span>
            </div>
            <div className="hero-stats">
              <div>
                <div className="stat-num">1.1B</div>
                <div className="stat-lbl">人が深刻な<br/>多次元的貧困<br/><span style={{fontSize:'9px',letterSpacing:'1px',color:'#CBD5E1'}}>UNDP 2024</span></div>
              </div>
              <div>
                <div className="stat-num">3.8B</div>
                <div className="stat-lbl">人が社会保護を<br/>まったく受けていない<br/><span style={{fontSize:'9px',letterSpacing:'1px',color:'#CBD5E1'}}>UN 2024</span></div>
              </div>
              <div>
                <div className="stat-num">0円</div>
                <div className="stat-lbl">SOS側は<br/>完全無料</div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY WE BUILT */}
        <section className="story-section">
          <p className="section-tag">Why we built this</p>
          <div className="why-grid">
            <div>
              <h2 className="why-h2">
                「助けて」が<br/>
                言えない社会に、<br/>
                <em>私たちは気づいた。</em>
              </h2>
              <p className="why-p">
                生活が苦しくなった時、家族関係に悩んだ時、孤立してしまった時——多くの人は誰にも言えずに抱え込みます。「迷惑をかけたくない」「自分だけが弱いのでは」という思いが、声を上げる手を止める。
              </p>
              <p className="why-p">
                一方で、支援したいNPO・企業・行政・公共機関は世界中に何十万も存在します。専門的な知識と温かい手を持つ人たちが、助けを必要としている人に出会えないまま、時間が過ぎていく。
              </p>
              <p className="why-p">
                このミスマッチは、テクノロジーで解決できると確信しました。AIを活用したマッチングプラットフォーム「明日もsamasama」の開発は、その確信から始まりました。
              </p>
            </div>
            <div style={{position:'sticky', top:'120px'}}>
              <div className="quote-card">
                <p>
                  支援を受けるのは恥ずかしいことでも、弱いことでもない。人は誰かに支えられながら生きている——それが当たり前の社会をつくりたい、という思いから、このサービスは生まれました。
                </p>
                <p className="quote-author">Founder&apos;s Note</p>
              </div>
              <div className="data-card">
                <p>世界で多次元的な貧困に苦しむ人々のうち</p>
                <div className="data-big">584M</div>
                <div className="data-src">UNDP Global MPI 2024</div>
                <p>が18歳未満の子ども。貧困は次の世代へと連鎖する。しかし、適切なサポートが届けば、その連鎖は断ち切れる。</p>
              </div>
            </div>
          </div>
        </section>

        {/* LOGO STORY */}
        <section className="logo-section">
          <div className="logo-inner">
            <p className="section-tag">The Mark — ロゴに込めた思い</p>
            <div className="logo-grid">
              <div className="logo-visual">
                <div className="drop-float">
                  <svg width="160" height="190" viewBox="0 0 56 62" fill="none">
                    <defs>
                      <linearGradient id="drop-hero" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0BC5A4"/>
                        <stop offset="100%" stopColor="#0A8FD4"/>
                      </linearGradient>
                    </defs>
                    <path d="M28 3C28 3 6 25 6 39C6 51.7 16.1 57 28 57C39.9 57 50 51.7 50 39C50 25 28 3 28 3Z"
                      fill="url(#drop-hero)"/>
                    <circle cx="28" cy="42" r="10" fill="white" opacity="0.2"/>
                  </svg>
                </div>
                <div className="size-row">
                  {[['64','14','2'],['40','13','1'],['24','13','1'],['16','12','1']].map(([s,rx,op])=>(
                    <div key={s} className="size-item">
                      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
                        <rect width="56" height="56" rx={rx} fill="#0A1628"/>
                        <path d="M28 6C28 6 10 24 10 36C10 45.9 18.1 50 28 50C37.9 50 46 45.9 46 36C46 24 28 6 28 6Z" fill="#0BC5A4"/>
                        {Number(s) >= 40 && <circle cx="28" cy="38" r="8" fill="white" opacity={op}/>}
                      </svg>
                      <div className="size-lbl">{s}px</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="logo-h2">
                  涙は、<br/>
                  悲しみだけの<br/>
                  ものじゃない。
                </h2>
                <ul className="meaning-list">
                  <li className="meaning-item">
                    <div className="meaning-icon">💧</div>
                    <div>
                      <h4 className="meaning-h4">形の意味 — 涙のかたち</h4>
                      <p className="meaning-p">
                        涙のかたちは、追い詰められた誰かの痛みを表しています。泣くほど辛い状況を、私たちは直視する。目を逸らさない。そのための形です。
                      </p>
                    </div>
                  </li>
                  <li className="meaning-item">
                    <div className="meaning-icon">🌊</div>
                    <div>
                      <h4 className="meaning-h4">グラデーションの意味 — 変化と可能性</h4>
                      <p className="meaning-p">
                        青緑（自然・癒し）から深い青（信頼・技術）へ。困難の中にある静けさと、その先に広がる可能性。変化は、いつも少しずつ始まる。
                      </p>
                    </div>
                  </li>
                  <li className="meaning-item">
                    <div className="meaning-icon">✨</div>
                    <div>
                      <h4 className="meaning-h4">内側の光の意味 — 消えない灯</h4>
                      <p className="meaning-p">
                        どんなに辛い状況でも、内側に灯は残っている。支援とは、その灯を一緒に育てることだと私たちは信じています。
                      </p>
                    </div>
                  </li>
                  <li className="meaning-item">
                    <div className="meaning-icon">🙏</div>
                    <div>
                      <h4 className="meaning-h4">涙が変わる瞬間 — サービスの本質</h4>
                      <p className="meaning-p">
                        悲しみの涙が、感謝の涙に変わる瞬間。そこに立ち会いたくて、私たちはこのサービスをつくりました。ロゴはその誓いです。
                      </p>
                    </div>
                  </li>
                  <li className="meaning-item">
                    <div className="meaning-icon">📐</div>
                    <div>
                      <h4 className="meaning-h4">実用的な意味 — どんな場所でも</h4>
                      <p className="meaning-p">
                        1つの太い塊だから、16pxのファビコンでも、大きなバナーでも、同じシルエットで伝わる。複雑さを排して、本質だけを残した形です。
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* VALUES */}
        <section className="story-section">
          <p className="section-tag">Our Values</p>
          <h2 className="values-h2">
            テクノロジーは<br/>
            人を<em>つなぐ</em>ための<br/>
            道具にすぎない。
          </h2>
          <div className="values-grid">
            {[
              ['01','尊厳を守る','支援を受けることを、恥だと感じさせない。相談者の個人情報は、承認するまでサポーターに渡りません。自分のペースで、自分の意思で動ける設計です。'],
              ['02','対等な関係','支援する側・される側という上下ではなく、同じ社会で生きる者同士として出会う場所。「samasama（さまさま）」という名前に込めた思いです。'],
              ['03','AIは架け橋','AIは支援の決定をしません。あくまで出会いを促す架け橋です。最後に動くのは、人間の温かさと意思。テクノロジーはその補助をするだけです。'],
              ['04','声なき声を聞く','「助けて」と言葉にできない人のために、少ない言葉でも状況を理解しようとするAI設計。敷居を低く、間口を広く。'],
              ['05','持続可能な支援','一度きりで終わらない関係を設計します。バッジや感謝の仕組みで、サポーターのモチベーションも守る。持続可能な支援のエコシステムを目指します。'],
              ['06','SDGsへの誠実さ','目の前の一人の生活を支えることが、すでにSDGsの実践です。世界の課題は、ローカルな一歩から動き始める。'],
            ].map(([n,h,p])=>(
              <div key={n} className="val-card">
                <div className="val-num">{n}</div>
                <h3 className="val-h3">{h}</h3>
                <p className="val-p">{p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* MESSAGE */}
        <section className="message-sec">
          <svg className="msg-bg" width="700" height="700" viewBox="0 0 56 56" fill="none">
            <path d="M28 2C28 2 4 26 4 40C4 52.1 15 58 28 58C41 58 52 52.1 52 40C52 26 28 2 28 2Z" fill="white"/>
          </svg>
          <div className="msg-inner">
            <span className="msg-tag">A Message from the Team</span>
            <p className="msg-body">
              私たちが恐れるのは、<br/>
              誰かが<strong>「もう明日はいらない」</strong>と思ってしまう瞬間です。<br/><br/>
              このサービスの名前「明日もsamasama」は、<br/>
              特別な明日でなくていい、という意味が込められています。<br/><br/>
              今日と<strong>同じくらいの明日が来る</strong>こと。<br/>
              それが、生きていくための最低限の希望だと思うから。<br/><br/>
              世界中の、声を上げられずにいる誰かのために。<br/>
              その希望を守るために、<br/>
              私たちは今日も、このプラットフォームを育てています。
            </p>
            <p className="msg-sign">明日もsamasama Team — 2026</p>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-sec">
          <h2 className="cta-h2">一歩、踏み出してみませんか。</h2>
          <p className="cta-p">
            相談は無料。匿名でも大丈夫。<br/>
            あなたの状況に合ったサポーターを、AIが一緒に探します。
          </p>
          <Link href="/signup" className="cta-btn">
            <svg width="16" height="16" viewBox="0 0 56 56" fill="none">
              <path d="M28 4C28 4 8 24 8 38C8 49.5 17.1 54 28 54C38.9 54 48 49.5 48 38C48 24 28 4 28 4Z" fill="white"/>
            </svg>
            無料で相談する
          </Link>
        </section>

        {/* FOOTER */}
        <footer className="story-footer">
          <p className="footer-copy">© 2026 明日もsamasama. All rights reserved.</p>
          <p className="footer-copy" style={{letterSpacing:'3px'}}>SDGs MATCH PLATFORM</p>
        </footer>

      </div>
    </>
  )
}
