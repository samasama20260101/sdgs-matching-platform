// ストーリー(公開・日本語だけ)。運営チームの言葉は v1 のまま残し、仕組みの言葉だけ v2 にそろえる
// (SOSユーザー → 相談する人、サポーター → 支え手。AI は支え手を選ばず、申し出は支え手から届く)
import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { DocProse, DocShell } from '@/components/app/DocShell'
import { Mark } from '@/components/app/Mark'
import { Card, Heading, Lead } from '@/components/app/ui'

export const metadata: Metadata = { title: 'ストーリー | 明日もsamasama' }

const WHY = [
  '生活が苦しくなった時、家族関係に悩んだ時、孤立してしまった時——多くの人は誰にも言えずに抱え込みます。「迷惑をかけたくない」「自分だけが弱いのでは」という思いが、声を上げる手を止める。',
  '一方で、支援したいNPO・企業・行政は世界中に何千も存在します。専門的な知識と温かい手を持つ人たちが、助けを必要としている人に出会えないまま時間が過ぎていく。',
  'このミスマッチは、テクノロジーで解決できると確信しました。AIを架け橋として、「明日もsamasama」の開発が始まりました。',
]

const MARK_MEANINGS = [
  { title: '形に込めた意味', body: '涙のかたちは、追い詰められた誰かの痛みを表します。その痛みから目を背けないために、まず涙と向き合うことから始めました。' },
  { title: 'グラデーションの意味', body: 'ティールから深いブルーへ。これは「海」の色。どんな川も最後は海につながるように、困難の中にいる人も必ずどこかへつながっていける。' },
  { title: '内側の光の意味', body: '涙型の底に、うっすらと白い光があります。どんなに暗い状況でも内側に灯は残っている。支援とは、その灯を一緒に育てること。' },
  { title: '涙が変わる瞬間', body: '悲しみの涙が感謝の涙に変わる瞬間——それがこのプラットフォームの存在意義です。同じ一滴に、ふたつの意味を込めました。' },
]

const VALUES = [
  { n: '01', title: '尊厳を守る', body: '相談者の連絡先が支え手に伝わることはありません。どの支え手と話すかは、自分のペースで選べる設計です。' },
  { n: '02', title: '対等な関係', body: '「samasama」という名前には、支援する側・される側という上下関係をなくしたいという思いが込められています。' },
  { n: '03', title: 'AIは架け橋', body: 'AIは出会いを促す架け橋です。最後に動くのは人間の温かさと意思。テクノロジーはその補助です。' },
  { n: '04', title: '声なき声を聞く', body: '少ない言葉でも状況を理解しようとするAI設計。世界中どこからでも、敷居を低く、間口を広く。' },
  { n: '05', title: '持続できる仕組み', body: '一度きりでなく関係が続く設計。支え手のモチベーションも守り、持続可能な支援のエコシステムを目指します。' },
  { n: '06', title: 'SDGsへの誠実さ', body: 'SDGsは私たちの羅針盤。相談する人には求めません。困りごとをAIが分類し最適な支援者へつなぐ、内側の地図として活用します。' },
]

const GLOBAL = [
  { num: '700M', label: '極度の貧困人口', src: 'World Bank, 2024' },
  { num: '1B+', label: '障害を持つ人々', src: 'WHO, 2023' },
  { num: '122M', label: '強制移動・難民', src: 'UNHCR, 2024' },
  { num: '3.3B', label: '最低賃金以下で就労', src: 'ILO, 2023' },
]

export default function StoryPage() {
  return (
    <DocShell jaOnly>
      <section className="flex flex-col gap-4 rounded-soft bg-night px-5 py-8 text-white">
        <h1 className="m-0 font-heading text-[28px] font-bold leading-[1.6]">
          ひとりで抱えないで。<br />誰かが、きっといる。
        </h1>
        <p className="m-0 text-[14px] leading-[1.9] text-white/85">
          社会の隅で、声を上げられずにいる人たちがいる。<br />
          私たちはその声を、必要な人へ届けたかった。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={2}>「助けて」が言えない社会に、<br />私たちは気づいた。</Heading>
        <DocProse>
          {WHY.map((p) => <p key={p}>{p}</p>)}
        </DocProse>
        <Card className="flex flex-col gap-2 bg-kinari-deep p-4">
          <p className="m-0 font-heading text-[15px] leading-[1.9] text-ink">
            支援を受けることは、恥でも弱さでもない。人は誰かに支えられながら生きている——それが当たり前の社会をつくりたい。
          </p>
        </Card>
        <Card className="flex flex-col gap-1.5 bg-lamp-faint p-4">
          <span className="text-[15px] font-bold text-ink">SDGsは、私たちの羅針盤。</span>
          <p className="m-0 text-[13.5px] leading-[1.85] text-ink-soft">
            相談する人はSDGsを知らなくていい。ただ「困っている」と言えばいい。私たちがその内容をSDGsの視点で分類し、合う支え手へつなぐ。SDGsは強要するものではなく、支援の精度を上げるための<strong className="text-ink">内側の地図</strong>です。
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={2}>涙は、悲しみだけのものじゃない。<br />その一滴に込めた意味。</Heading>
        <div className="flex justify-center py-2"><Mark size={96} /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {MARK_MEANINGS.map((m) => (
            <Card key={m.title} className="flex flex-col gap-1.5 p-4">
              <span className="text-[14.5px] font-bold text-ink">{m.title}</span>
              <p className="m-0 text-[13px] leading-[1.8] text-ink-soft">{m.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={2}>テクノロジーは人をつなぐための<br />道具にすぎない。</Heading>
        <div className="grid gap-2 sm:grid-cols-2">
          {VALUES.map((v) => (
            <Card key={v.n} className="flex flex-col gap-1.5 p-4">
              <span className="flex items-baseline gap-2">
                <span className="font-heading text-[13px] font-bold text-mist">{v.n}</span>
                <span className="text-[14.5px] font-bold text-ink">{v.title}</span>
              </span>
              <p className="m-0 text-[13px] leading-[1.8] text-ink-soft">{v.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-soft bg-night px-5 py-8 text-center text-white">
        <p className="m-0 font-heading text-[15px] leading-[2.4] text-white/90">
          ひとりで抱えきれない問題に向き合うとき、<br />
          答えがわからないままでは、<br />
          <strong className="text-lamp">明日が来ることが困難だと思う人</strong>が<br />
          きっといるとしたら。<br /><br />
          情報がその答えならば、<br />
          <strong className="text-white">知りたいときに手が届く場所</strong>になければならない。<br /><br />
          答えがあるならば、<br />
          <strong className="text-white">必要とする人のもとに伝わら</strong>なければならない。<br /><br />
          今日も、明日も、変わらずその先も。<br /><br />
          それでは、また明日も、<strong className="text-lamp">samasama</strong>。
        </p>
        <Mark size={32} />
        <span className="text-[11.5px] text-white/60">明日もsamasama 開発チーム — 2026</span>
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={2}>SDGsが示す課題は、<br />今ここにある現実だ。</Heading>
        <Lead>だから私たちは、それを支援の指標にする。</Lead>
        <dl className="m-0 grid grid-cols-2 gap-2">
          {GLOBAL.map((s) => (
            <div key={s.num} className="flex flex-col gap-0.5 rounded-soft border border-line bg-paper p-4">
              <dd className="m-0 font-heading text-[24px] font-bold leading-none text-night">{s.num}</dd>
              <dt className="mt-1.5 text-[12.5px] font-bold text-ink">{s.label}</dt>
              <span className="text-[11px] text-mist">{s.src}</span>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-[16px] bg-kinari-deep p-4">
        <Heading level={2}>一歩、踏み出してみませんか。</Heading>
        <Lead>相談は無料です。本名を出さずに、呼び名で相談できます。書いた相談を見た支え手から申し出が届き、話す相手はあなたが選びます。</Lead>
        <Link href="/consult/new" className="flex min-h-[52px] items-center justify-center rounded-[16px] bg-night px-4 text-[15px] font-bold tracking-[0.1em] text-white no-underline">
          無料で相談する
        </Link>
        <Link href="/supporters" className="flex min-h-[48px] items-center justify-center rounded-[16px] border-[1.5px] border-line-strong bg-paper px-4 text-[14px] font-bold text-ink no-underline">
          支え手と団体を見る
        </Link>
      </section>
    </DocShell>
  )
}
