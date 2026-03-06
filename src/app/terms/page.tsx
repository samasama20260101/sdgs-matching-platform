import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

export const metadata = { title: '利用規約 | 明日もsamasama' }

const UPDATED = '2026年4月1日'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/"><Logo variant="default" size="sm" showText={true} /></Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-teal-600 transition-colors">← トップへ</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        {/* タイトル */}
        <div className="mb-12">
          <p className="text-xs text-teal-600 font-mono tracking-[4px] uppercase mb-3">Terms of Service</p>
          <h1 className="text-3xl font-black text-gray-900 mb-2">利用規約</h1>
          <p className="text-sm text-gray-400">最終更新日：{UPDATED}</p>
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 leading-8 space-y-10">

          <section>
            <p>
              本利用規約（以下「本規約」）は、明日もsamasama運営チーム（以下「運営」）が提供するSDGsマッチングプラットフォーム「明日もsamasama」（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用になる前に、必ずお読みください。登録または利用をもって、本規約に同意したものとみなします。
            </p>
          </section>

          <Section title="第1条（定義）">
            <p>本規約において使用する用語の定義は以下のとおりです。</p>
            <ul>
              <li>「SOSユーザー」とは、生活上の困りごとや社会的課題について相談・支援を求める目的で登録した個人を指します。</li>
              <li>「サポーター」とは、NPO・一般社団法人・企業・個人事業者など、支援を提供する目的で登録した団体または個人を指します。</li>
              <li>「ユーザー」とは、SOSユーザーとサポーターの総称です。</li>
              <li>「マッチング」とは、SOSユーザーの相談内容とサポーターをAIが分析・提示し、双方が合意することで支援関係が開始される一連のプロセスを指します。</li>
            </ul>
          </Section>

          <Section title="第2条（登録と資格）">
            <ul>
              <li>本サービスへの登録は、本規約への同意を条件とします。</li>
              <li>未成年者が登録する場合は、保護者の同意を得たうえでご利用ください。</li>
              <li>過去に本規約違反により登録を抹消された方は、再登録できません。</li>
              <li>登録情報は正確かつ最新の状態を保つよう努めてください。</li>
            </ul>
          </Section>

          <Section title="第3条（プライバシーと個人情報）">
            <ul>
              <li>SOSユーザーの個人情報は、当該ユーザーが明示的に承認するまでサポーターに開示されません。</li>
              <li>個人情報の取り扱いについては、別途定める<Link href="/privacy" className="text-teal-600 underline underline-offset-2">プライバシーポリシー</Link>に従います。</li>
              <li>AIによる相談内容の分析は、マッチング精度向上のためにのみ使用され、第三者への販売・提供は行いません。</li>
            </ul>
          </Section>

          <Section title="第4条（禁止事項）">
            <p>ユーザーは以下の行為を行ってはなりません。</p>
            <ul>
              <li>虚偽の情報を登録・送信する行為</li>
              <li>本サービスを通じて知り得た他のユーザーの個人情報を無断で利用・流用する行為</li>
              <li>サポーターが本サービス外での金銭授受を要求する行為（詐欺的行為）</li>
              <li>本サービスを通じた勧誘・営業・宗教活動</li>
              <li>他のユーザーへの誹謗中傷・ハラスメント</li>
              <li>本サービスのシステムに不正アクセスを試みる行為</li>
              <li>その他、運営が不適切と判断する行為</li>
            </ul>
          </Section>

          <Section title="第5条（マッチングと支援関係）">
            <ul>
              <li>マッチングはあくまでSOSユーザーとサポーターの出会いの場を提供するものです。支援内容・効果を運営が保証するものではありません。</li>
              <li>SOSユーザーは、いつでも相談を取り下げ・終了することができます。</li>
              <li>サポーターは、正当な理由なく相談を放棄しないよう努めてください。</li>
              <li>支援に関するトラブルが発生した場合は、まず当事者間での解決を試み、解決できない場合は運営にご連絡ください。</li>
            </ul>
          </Section>

          <Section title="第6条（コンテンツと知的財産）">
            <ul>
              <li>ユーザーが本サービス上に投稿・送信したテキスト・画像等のコンテンツの著作権は、原則として投稿者本人に帰属します。</li>
              <li>ユーザーは、運営に対してサービス改善・品質向上の目的でのコンテンツ利用を許諾するものとします。</li>
              <li>本サービスのロゴ・デザイン・システムに関する知的財産権は運営に帰属します。</li>
            </ul>
          </Section>

          <Section title="第7条（サービスの変更・停止）">
            <ul>
              <li>運営は、事前の通知なくサービス内容の変更・追加・停止を行う場合があります。</li>
              <li>システムメンテナンス・不可抗力によるサービス停止について、運営は責任を負いません。</li>
              <li>重要な変更がある場合は、登録メールアドレスへの通知またはサービス内告知を行います。</li>
            </ul>
          </Section>

          <Section title="第8条（登録抹消）">
            <ul>
              <li>ユーザーはいつでも退会（登録抹消）を申請できます。</li>
              <li>本規約に違反したユーザーに対して、運営は事前通知なく登録を抹消することができます。</li>
              <li>退会後も、法令で定められた期間または運営が必要と判断する期間、一部のデータを保持する場合があります。</li>
            </ul>
          </Section>

          <Section title="第9条（免責事項）">
            <ul>
              <li>本サービスは、SOSユーザーとサポーターのマッチングを支援するプラットフォームです。支援の結果や効果について運営は責任を負いません。</li>
              <li>ユーザー間のトラブル・損害について、運営は原則として責任を負いません。</li>
              <li>本サービスは緊急時の相談窓口ではありません。生命・身体に危険が及ぶ緊急事態は、警察（110）・救急（119）・よりそいホットライン（0120-279-338）にご連絡ください。</li>
            </ul>
          </Section>

          <Section title="第10条（規約の改定）">
            <p>
              運営は、必要に応じて本規約を改定することができます。改定後の規約は、本サービス上への掲載をもって効力を生じます。重要な変更の際はメール等でお知らせします。改定後も本サービスをご利用になった場合、改定後の規約に同意したものとみなします。
            </p>
          </Section>

          <Section title="第11条（準拠法・管轄）">
            <p>
              本規約の解釈・適用は日本法に準拠します。本サービスに関する紛争については、運営所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </Section>

          <div className="pt-8 border-t border-gray-100 text-sm text-gray-400">
            <p>制定日：2026年4月1日　／　最終更新日：{UPDATED}</p>
            <p className="mt-1">明日もsamasama 運営チーム</p>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/terms" className="text-teal-600 font-medium">利用規約</Link>
          <Link href="/privacy" className="hover:text-teal-600 transition-colors">プライバシーポリシー</Link>
          <Link href="/contact" className="hover:text-teal-600 transition-colors">お問い合わせ</Link>
        </div>
        <p>© 2026 明日もsamasama. All rights reserved.</p>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">{title}</h2>
      <div className="space-y-3 text-sm text-gray-600 leading-8">{children}</div>
    </section>
  )
}
