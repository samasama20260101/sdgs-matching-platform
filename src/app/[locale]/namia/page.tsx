import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/icons/Logo';

export const metadata: Metadata = {
  title: 'なみあ | 明日もsamasama',
  description: '涙の中に残る小さな灯から生まれた、明日もsamasamaの案内役「なみあ」の紹介ページです。',
};

const abilitySteps = [
  {
    title: '声を見つける',
    body: 'うまく言えない気持ちも、なみあはそっと見つけます。',
    icon: 'SOS',
    color: 'bg-teal-500',
  },
  {
    title: '灯をわける',
    body: 'おなかの丸い光が、小さな「みちあかり」になります。',
    icon: 'LIGHT',
    color: 'bg-amber-400',
  },
  {
    title: '道をつなぐ',
    body: 'その光が、必要な支援へ向かう道を照らします。',
    icon: 'SUPPORT',
    color: 'bg-blue-500',
  },
];

const profileItems = [
  ['正式名', 'なみあ'],
  ['愛称', 'なみあちゃん'],
  ['能力', 'みちあかり'],
  ['好きなこと', '小さな声に気づくこと'],
  ['苦手なこと', 'だれかが一人で抱え込むこと'],
  ['役割', '声が届くまでの道を消さない案内役'],
];

const awarenessUseItems = [
  {
    title: 'チラシ・名刺',
    body: '右下や余白に小さく置いて、サービス名だけでは伝わりにくい「相談への入口」をやわらかく残します。',
  },
  {
    title: 'SNS・お知らせ',
    body: '制度紹介やイベント告知に添えることで、硬い情報を少し読みやすくします。深刻な相談事例の横では使いすぎない方針です。',
  },
  {
    title: '説明資料',
    body: '行政・NPO・学校・地域団体向けの説明で、明日もsamasamaの思想を覚えてもらう記憶点として使います。',
  },
];

const poseItems = [
  {
    title: 'おてふり',
    body: 'はじめて会う人にも、こわくないよと伝えるポーズ。',
    src: '/concepts/mascots/namia-pose-wave-transparent-compact.png',
    width: 963,
    height: 1268,
  },
  {
    title: 'きく',
    body: 'まだ言葉になっていない気持ちを、そっと待つポーズ。',
    src: '/concepts/mascots/namia-pose-listen-transparent-compact.png',
    width: 768,
    height: 1227,
  },
  {
    title: 'ぴょん',
    body: '声が支援に届いたときの、うれしいジャンプ。',
    src: '/concepts/mascots/namia-pose-jump-transparent-compact.png',
    width: 964,
    height: 1165,
  },
  {
    title: 'みちあかり',
    body: 'おなかの灯を小さな光にして、道を照らすポーズ。',
    src: '/concepts/mascots/namia-pose-light-transparent-compact.png',
    width: 759,
    height: 1203,
  },
  {
    title: 'ちらっ',
    body: '話しかける勇気が出るまで、そばで見守るポーズ。',
    src: '/concepts/mascots/namia-pose-peek-transparent-compact.png',
    width: 778,
    height: 1187,
  },
];

const funItems = [
  {
    title: 'サッカー',
    body: '地域イベントや子ども向け資料にも置きやすい、元気ななみあ。',
    src: '/concepts/mascots/namia-fun-soccer-transparent-compact.png',
    width: 1052,
    height: 1117,
  },
  {
    title: 'ころん',
    body: '失敗しても大丈夫。ちょっと照れながら、また起き上がります。',
    src: '/concepts/mascots/namia-fun-fall-transparent-compact.png',
    width: 1138,
    height: 914,
  },
  {
    title: 'おちゃめ',
    body: '名刺やチラシの端に入れると、少し話しかけやすくなる表情。',
    src: '/concepts/mascots/namia-fun-wink-transparent-compact.png',
    width: 762,
    height: 1181,
  },
  {
    title: '名刺のすみ',
    body: 'カードの右下やスライドの余白に置きやすい、小さめポーズ。',
    src: '/concepts/mascots/namia-fun-card-transparent-compact.png',
    width: 597,
    height: 864,
  },
  {
    title: 'はしる',
    body: '「届ける」「向かう」の表現に使いやすい、動きのあるポーズ。',
    src: '/concepts/mascots/namia-fun-run-transparent-compact.png',
    width: 984,
    height: 1164,
  },
];

const actionPoseItems = [
  {
    title: 'うなずく',
    body: '「その気持ち、受けとめたよ」と静かに伝えるポーズ。',
    colorSrc: '/concepts/mascots/namia-action-nod-color-transparent.png',
    lineSrc: '/concepts/mascots/namia-action-nod-line-transparent.png',
    width: 1254,
    height: 1254,
    lineWidth: 1254,
    lineHeight: 1254,
  },
  {
    title: '手を振る',
    body: 'はじめての人にも、やさしく入口を示すポーズ。',
    colorSrc: '/concepts/mascots/namia-action-wave-color-transparent.png',
    lineSrc: '/concepts/mascots/namia-action-wave-line-transparent.png',
    width: 1254,
    height: 1254,
    lineWidth: 1254,
    lineHeight: 1254,
  },
  {
    title: '光を差し出す',
    body: 'おなかの灯をわけて、次の一歩を照らすポーズ。',
    colorSrc: '/concepts/mascots/namia-action-offer-light-color-transparent.png',
    lineSrc: '/concepts/mascots/namia-action-offer-light-line-transparent.png',
    width: 1086,
    height: 1448,
    lineWidth: 1024,
    lineHeight: 1536,
  },
  {
    title: '考える',
    body: '急がず、相手に合う道を一緒に探すポーズ。',
    colorSrc: '/concepts/mascots/namia-action-thinking-color-transparent.png',
    lineSrc: '/concepts/mascots/namia-action-thinking-line-transparent.png',
    width: 1122,
    height: 1402,
    lineWidth: 1254,
    lineHeight: 1254,
  },
  {
    title: '安心してほほえむ',
    body: 'ひとりではないことを、静かに伝える表情。',
    colorSrc: '/concepts/mascots/namia-action-smile-color-transparent.png',
    lineSrc: '/concepts/mascots/namia-action-smile-line-transparent.png',
    width: 1024,
    height: 1536,
    lineWidth: 1122,
    lineHeight: 1402,
  },
];

const assetItems = [
  {
    title: '基本立ち絵',
    kind: 'SVG',
    src: '/concepts/mascots/namia-character.svg',
    href: '/concepts/mascots/namia-character.svg',
    body: '公式の標準ポーズ。資料表紙、Web、チラシのメインビジュアル向き。拡大しても劣化しません。',
    preview: 'svg',
  },
  {
    title: 'ミニアイコン',
    kind: 'SVG',
    src: '/concepts/mascots/namia-mini-icon.svg',
    href: '/concepts/mascots/namia-mini-icon.svg',
    body: 'A2ベースの公式ミニ候補。SNSアイコン、資料の角、見出し横に置きやすい簡略版。',
    preview: 'svg',
  },
  {
    title: '吹き出しテンプレ（通常）',
    kind: 'SVG',
    src: '/concepts/mascots/namia-speech-bubble-template.svg',
    href: '/concepts/mascots/namia-speech-bubble-template.svg',
    body: '通常アイコン版。なみあをしっかり見せたい啓発投稿やチラシ向き。',
    preview: 'wide',
  },
  {
    title: '吹き出しテンプレ（ミニ）',
    kind: 'SVG',
    src: '/concepts/mascots/namia-speech-bubble-mini-template.svg',
    href: '/concepts/mascots/namia-speech-bubble-mini-template.svg',
    body: 'ミニアイコン版。紙面を軽く保ちながら、ひとことコピーを前に出せます。',
    preview: 'wide',
  },
  {
    title: 'SNSカード（通常）',
    kind: 'SVG',
    src: '/concepts/mascots/namia-social-card-template.svg',
    href: '/concepts/mascots/namia-social-card-template.svg',
    body: '通常アイコン版。キャラクターの存在感で認知を取りにいく1200x630カード。',
    preview: 'wide',
  },
  {
    title: 'SNSカード（ミニ）',
    kind: 'SVG',
    src: '/concepts/mascots/namia-social-card-mini-template.svg',
    href: '/concepts/mascots/namia-social-card-mini-template.svg',
    body: 'ミニアイコン版。テキストや告知内容を主役にしたい投稿向き。',
    preview: 'wide',
  },
  {
    title: 'みちあかり単体',
    kind: 'SVG',
    src: '/concepts/mascots/namia-michikari-light-trail.svg',
    href: '/concepts/mascots/namia-michikari-light-trail.svg',
    body: 'キャラを出しすぎず、ブランド感だけ添えたい時の光の軌跡。',
    preview: 'wide',
  },
  {
    title: '線画版',
    kind: 'SVG',
    src: '/concepts/mascots/namia-line-art.svg',
    href: '/concepts/mascots/namia-line-art.svg',
    body: '白黒印刷、行政資料、ワークシート向けの単色素材。',
    preview: 'svg',
  },
  {
    title: 'きくポーズ',
    kind: 'SVG',
    src: '/concepts/mascots/namia-pose-listen.svg',
    href: '/concepts/mascots/namia-pose-listen.svg',
    body: '相談入力、話を聞く導線、子ども向け説明に使いやすいポーズ。',
    preview: 'svg',
  },
  {
    title: '名刺のすみ',
    kind: 'SVG',
    src: '/concepts/mascots/namia-card-corner.svg',
    href: '/concepts/mascots/namia-card-corner.svg',
    body: '名刺、スライド、案内カードのフチから、なみあがひょっこりのぞく小さめ素材。',
    preview: 'svg',
  },
  {
    title: 'みちあかり説明',
    kind: 'SVG',
    src: '/concepts/mascots/namia-michikari-concept.svg',
    href: '/concepts/mascots/namia-michikari-concept.svg',
    body: '相談者から支援先へつながるイメージを説明する横長ビジュアル。',
    preview: 'wide',
  },
];

export default function NamiaPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfffd] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-teal-100 bg-white/88 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" aria-label="明日もsamasama トップへ">
            <Logo variant="default" size="sm" showText={true} />
          </Link>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold tracking-[0.18em] text-teal-700">
            BRAND CHARACTER KIT
          </span>
        </div>
      </header>

      <section className="relative pt-28 sm:pt-32">
        <div className="absolute inset-x-0 top-16 h-[520px] bg-[linear-gradient(135deg,#e8fff9_0%,#f7fbff_48%,#fff8e5_100%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20">
          <div className="order-2 lg:order-1">
            <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black tracking-[0.18em] text-teal-600 shadow-sm">
              NAMIA / MICHIAKARI
            </p>
            <h1 className="text-5xl font-black leading-none tracking-normal text-slate-950 sm:text-7xl">
              なみあ
            </h1>
            <p className="mt-5 max-w-xl text-xl font-bold leading-relaxed text-slate-700 sm:text-2xl">
              涙の中に残る、小さな灯から生まれた案内役。
            </p>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
              ひとりで抱えきれない気持ちがあるとき、なみあのおなかの丸い光が
              「みちあかり」になって、必要な支援へ続く道をそっと照らします。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {['一人にしない', '声を届ける', '道を照らす'].map((label) => (
                <span key={label} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#asset-kit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700">
                素材をダウンロード
              </a>
              <a href="#use-guide" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:text-teal-700">
                使い方を見る
              </a>
            </div>
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <div className="relative w-full max-w-[430px]">
              <div className="absolute left-4 top-10 h-20 w-20 rounded-full bg-amber-200/70 blur-2xl" />
              <div className="absolute bottom-16 right-0 h-24 w-24 rounded-full bg-blue-200/70 blur-2xl" />
              <Image
                src="/concepts/mascots/namia-character-transparent-compact.png"
                alt="なみあ。涙型の体とおなかの丸い光を持つキャラクター。"
                width={910}
                height={1223}
                priority
                className="relative h-auto w-full drop-shadow-[0_28px_38px_rgba(10,143,212,0.22)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 md:grid-cols-3">
            {abilitySteps.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-slate-100 bg-slate-50 p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${step.color} text-sm font-black text-white`}>
                    {index + 1}
                  </span>
                  <span className="text-xs font-black tracking-[0.16em] text-slate-400">{step.icon}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">{step.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="use-guide" className="bg-[#f8fbff] px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-blue-600">AWARENESS USE</p>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              知ってもらうための、なみあ。
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              なみあは、サービスを売り込むキャラではなく、明日もsamasamaを思い出してもらうための記憶点です。
              相談への入口をやさしく示す場面で使います。
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {awarenessUseItems.map((item) => (
              <div key={item.title} className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-black text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            <p className="font-black">使い方の注意</p>
            <p className="mt-1">
              なみあは困りごとを解決する存在ではなく、相談につながる最初の灯です。
              緊急時や深刻な相談本文のすぐ横では大きく使わず、案内・啓発・資料の入口で控えめに使います。
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#082035] px-4 py-16 text-white sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg bg-white/5 p-3">
            <Image
              src="/concepts/mascots/namia-michikari-concept.svg"
              alt="なみあの紹介イメージ。相談者から支援先へみちあかりが続く。"
              width={1200}
              height={500}
              className="h-auto w-full rounded-lg"
            />
          </div>
          <div>
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-teal-300">SPECIAL ABILITY</p>
            <h2 className="text-3xl font-black leading-tight sm:text-5xl">
              みちあかり
            </h2>
            <p className="mt-6 text-base leading-8 text-slate-200">
              なみあの光は、誰かの代わりに答えを決める力ではありません。
              迷っている声が、途中で消えないようにするための灯です。
            </p>
            <p className="mt-4 text-base leading-8 text-slate-200">
              小さな光は、相談する人、支援する人、見守る運営をつないで、
              「ここから話していいんだ」と思える入口をつくります。
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-teal-600">PROFILE</p>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              なみあのこと
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              正式名は「なみあ」。呼びかけるときは「なみあちゃん」。
              子どもにも親しみやすく、でも涙の物語をちゃんと背負える名前です。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {profileItems.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black tracking-[0.16em] text-teal-500">{label}</p>
                <p className="mt-2 text-base font-bold leading-7 text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f5fffb_0%,#ffffff_100%)] px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-teal-600">NAMIA POSES</p>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              いろいろな、なみあ。
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              子どもにも親しみやすいように、表情とポーズを増やしました。
              どのなみあも、涙の中の丸い灯を持っています。
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {poseItems.map((pose) => (
              <div key={pose.title} className="rounded-lg border border-teal-100 bg-white p-4 shadow-sm">
                <div className="flex h-60 items-end justify-center rounded-lg bg-[radial-gradient(circle_at_50%_75%,#fff7d6_0%,#f0fffb_44%,#ffffff_76%)] sm:h-64">
                  <Image
                    src={pose.src}
                    alt={`なみあの${pose.title}ポーズ。`}
                    width={pose.width}
                    height={pose.height}
                    className="max-h-full w-auto object-contain drop-shadow-[0_12px_18px_rgba(10,143,212,0.18)]"
                  />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-900">{pose.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pose.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8fbff] px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-blue-600">NEW POSE PNG</p>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              表情と動きの、なみあ。
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              SVG化しやすいように、1ポーズずつ独立した背景透明PNGにしました。
              カラー版と白黒線画版を並べて確認できます。
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-5">
            {actionPoseItems.map((pose) => (
              <article key={pose.title} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <div className="grid gap-3">
                  <div>
                    <p className="mb-2 text-xs font-black tracking-[0.16em] text-teal-600">カラー</p>
                    <div className="flex h-52 items-end justify-center rounded-lg bg-[radial-gradient(circle_at_50%_78%,#fff8d7_0%,#eefcff_48%,#ffffff_78%)] p-3">
                      <Image
                        src={pose.colorSrc}
                        alt={`なみあの${pose.title}ポーズ カラー版。`}
                        width={pose.width}
                        height={pose.height}
                        className="max-h-full w-auto object-contain drop-shadow-[0_12px_18px_rgba(10,143,212,0.16)]"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-black tracking-[0.16em] text-slate-500">白黒線画</p>
                    <div className="flex h-52 items-end justify-center rounded-lg bg-white p-3">
                      <Image
                        src={pose.lineSrc}
                        alt={`なみあの${pose.title}ポーズ 白黒線画版。`}
                        width={pose.lineWidth}
                        height={pose.lineHeight}
                        className="max-h-full w-auto object-contain"
                      />
                    </div>
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-900">{pose.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{pose.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={pose.colorSrc}
                    download
                    className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700"
                  >
                    カラーPNG
                  </a>
                  <a
                    href={pose.lineSrc}
                    download
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
                  >
                    線画PNG
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-blue-600">PLAYFUL NAMIA</p>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              おちゃめな、なみあ。
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              名刺、イベント資料、子ども向けのお知らせにも使いやすいように、
              少し遊びのあるポーズも増やしました。
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {funItems.map((item) => (
              <div key={item.title} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex h-60 items-end justify-center rounded-lg bg-[radial-gradient(circle_at_50%_78%,#fff3ca_0%,#eef9ff_48%,#ffffff_78%)] sm:h-64">
                  <Image
                    src={item.src}
                    alt={`なみあの${item.title}ポーズ。`}
                    width={item.width}
                    height={item.height}
                    className="max-h-full w-auto object-contain drop-shadow-[0_12px_18px_rgba(10,143,212,0.18)]"
                  />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="asset-kit" className="bg-amber-50 px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-black tracking-[0.22em] text-amber-700">NAMIA ASSET KIT</p>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              広報で使える、なみあ素材。
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-700">
              チラシ、SNS、名刺、説明資料に使いやすい素材をまとめました。
              すべてSVGなので、名刺の角から大判ポスターまで、拡大してもきれいに使えます。
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {assetItems.map((asset) => (
              <article key={asset.title} className="flex flex-col rounded-lg border border-amber-100 bg-white p-5 shadow-sm">
                <div className="flex min-h-56 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_50%_75%,#fff9de_0%,#effffc_52%,#ffffff_80%)] p-4">
                  {/* 素材は全点SVGのため background-image でプレビュー（'wide'=横長 / 'svg'=縦横比あり） */}
                  <div
                    aria-label={`なみあ素材: ${asset.title}`}
                    className={`w-full rounded-md bg-contain bg-center bg-no-repeat ${asset.preview === 'wide' ? 'h-36' : 'h-48'}`}
                    style={{ backgroundImage: `url(${asset.src})` }}
                  />
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-black text-slate-900">{asset.title}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{asset.kind}</span>
                </div>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{asset.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={asset.href}
                    download
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    ダウンロード
                  </a>
                  <a
                    href={asset.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
                  >
                    表示
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-lg bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">素材利用の基本ルール</h3>
            <ul className="mt-3 space-y-2">
              <li>・おなかの丸い灯をハートなど別の形に変えない。</li>
              <li>・「なみあが解決する」ではなく、「相談につながる入口を照らす」と表現する。</li>
              <li>・深刻な相談本文や緊急画面の横では、大きく・楽しく見せすぎない。</li>
              <li>・明日もsamasamaの案内、啓発、広報、資料の記憶点として使う。</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
