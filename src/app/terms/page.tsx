import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

export const metadata = { title: '利用規約 | 明日もsamasama' }

const UPDATED = '2026年4月1日'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/"><Logo variant="default" size="sm" showText={true} /></Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-teal-600 transition-colors">← トップへ</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-12">
          <p className="text-xs text-teal-600 font-mono tracking-[4px] uppercase mb-3">Terms of Service</p>
          <h1 className="text-3xl font-black text-gray-900 mb-2">利用規約</h1>
          <p className="text-sm text-gray-400">最終更新日：{UPDATED}</p>
        </div>

        <div className="space-y-10 text-gray-700">

          <section>
            <p className="text-sm leading-8">
              本利用規約（以下「本規約」）は、合同会社ｓａｍａｓａｍａ（以下「当社」）が提供するプラットフォームサービス「明日もsamasama」（以下「本サービス」）の利用条件を定めるものです。本サービスを利用するすべての利用者（以下「利用者」）は、本規約に同意のうえ本サービスを利用するものとしますので、本サービスをご利用になる前に、必ずお読みください。登録または利用をもって、本規約に同意したものとみなします。
            </p>
          </section>

          <Section title="第1条（定義）">
            <p>本規約において使用する用語の定義は、以下のとおりとします。</p>
            <ul>
              <li><strong>本サービス：</strong>当社が提供するSOS掲載、支援マッチング、分析機能その他関連機能を含むオンラインプラットフォーム「明日もsamasama」。</li>
              <li><strong>利用者：</strong>本サービスを利用するすべての個人または団体であり、SOSユーザーとサポーターの総称。</li>
              <li><strong>SOS：</strong>ある主体（個人／地域／経済主体）が、社会的包摂・環境保護・経済成長の観点で、SDGsグローバル指標に照らして"望ましい状態"から逸脱（不足／超過／不均衡）していることを、支援者が介入可能な形で表明した支援要請。</li>
              <li><strong>SOSユーザー：</strong>本サービスにSOSを掲載し、支援を通した解決を求める目的で登録した利用者。SOSを持つ者に代わってSOS登録や本サービスを利用する代理登録者も含む。</li>
              <li><strong>サポーター：</strong>NPO・行政・企業・個人事業者など、本サービスを通じてSOSユーザーに対し協力、製品またはサービスを提供する目的で登録した利用者。</li>
              <li><strong>無償支援：</strong>サポーターがSOSユーザーに対して提供する無償/無料の支援、製品またはサービス。</li>
              <li><strong>有償支援：</strong>サポーターがSOSユーザーに対して対価を得て提供する支援、製品またはサービス。</li>
              <li><strong>マッチング：</strong>SOSユーザーの相談内容とサポーターをAIが分析・提示し、双方が合意することで支援関係が開始される一連のプロセス。</li>
              <li><strong>サポーター向けサービス：</strong>当社がサポーターに対して提供する掲載、分析、マッチング、その他のサービス。</li>
              <li><strong>利用契約：</strong>本規約に基づき利用者と当社との間で成立する本サービス利用に関する契約。</li>
            </ul>
          </Section>

          <Section title="第2条（会員登録）">
            <ul>
              <li>本サービスへの登録は、本規約への同意を条件とします。</li>
              <li>利用者は登録情報について正確かつ最新の状態を保つよう努めてください。</li>
              <li>当社は以下の場合、登録を拒否または取消すことがあります。
                <ul className="mt-2 ml-4 space-y-1">
                  <li>登録情報に虚偽がある場合</li>
                  <li>本規約に違反するおそれがある場合</li>
                  <li>過去に本規約違反により登録を抹消された方が再登録/再登録申請をした場合</li>
                  <li>その他当社が不適切と判断した場合</li>
                </ul>
              </li>
              <li>未成年の者が利用する場合、保護者の同意を得るものとします。</li>
              <li>保護者が虐待その他の加害行為の当事者と合理的に疑われる場合には、SOSユーザー本人の最善の利益を優先し、匿名化投稿や通報ルート整備等の保護措置を講じる場合があります。</li>
            </ul>
          </Section>

          <Section title="第3条（SOS掲載）">
            <ul>
              <li>SOSユーザーは当社所定の方法によりSOS内容を本サービスに掲載申請することができます。</li>
              <li>以下の内容を含むSOSは掲載してはなりません。
                <ul className="mt-2 ml-4 space-y-1">
                  <li>法令違反または犯罪行為に関連する内容</li>
                  <li>他者の権利を侵害する内容</li>
                  <li>差別的、暴力的または誹謗中傷を含む内容</li>
                  <li>政治活動または宗教活動の勧誘</li>
                  <li>虚偽または誤解を招く内容</li>
                </ul>
              </li>
              <li>当社は掲載内容が不適切と判断した場合、掲載拒否または削除することがあります。</li>
            </ul>
          </Section>

          <Section title="第4条（サポーターによる支援）">
            <ul>
              <li>サポーターは、本サービスを通じてSOSユーザーに対して支援を提案・提供することができます。</li>
              <li>有償支援に関する契約は、SOSユーザーとサポーターとの間で直接成立するものとし、当社は当該契約の当事者とはなりません。</li>
              <li>サポーターは提供する支援に関する品質・履行義務について責任を負います。不良品や契約不履行等のトラブルが発生した場合、サポーター自身の責任で解決し、当社に一切の請求をしないものとします。</li>
            </ul>
          </Section>

          <Section title="第5条（サポーター向けサービス）">
            <ul>
              <li>サポーターは当社が提供するサポーター向けサービスを利用することができます。</li>
              <li>サポーター向けサービスの利用条件および利用料金は、当社が別途定めるものとします。</li>
            </ul>
          </Section>

          <Section title="第6条（投稿コンテンツの利用）">
            <ul>
              <li>利用者が本サービス上に投稿・送信・登録したテキスト・画像等のコンテンツの著作権は、原則として投稿者本人に帰属します。</li>
              <li>利用者は、運営に対してサービス改善・品質向上の目的でのコンテンツ利用を無償で許諾するものとします。当社は必要に応じて匿名化したうえで当該情報を利用することがあります。</li>
              <li>本サービスのロゴ・デザイン・システムに関する知的財産権は当社に帰属します。</li>
            </ul>
          </Section>

          <Section title="第7条（個人情報の取扱い）">
            <ul>
              <li>SOSユーザーの個人情報は、当該ユーザーが明示的に承認するまでサポーターに開示されません。</li>
              <li>個人情報の取り扱いについては、別途定める<Link href="/privacy" className="text-teal-600 underline underline-offset-2">プライバシーポリシー</Link>に従います。</li>
            </ul>
          </Section>

          <Section title="第8条（禁止事項）">
            <p>利用者は本サービス利用に際し、以下の行為を行ってはなりません。</p>
            <ul>
              <li>虚偽情報の登録または掲載</li>
              <li>他者になりすます行為（代理登録者が利用する際は、代理登録者名で登録すること）</li>
              <li>本サービスを通じて知り得た他の利用者の情報を無断で利用・流用する行為</li>
              <li>サポーターが本サービス外での金銭授受を要求する行為</li>
              <li>本サービスを通じた勧誘・営業・宗教活動</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>本サービスのシステムに不正アクセスを試みる行為</li>
              <li>違法行為または犯罪行為</li>
              <li>法令または公序良俗に反する行為</li>
              <li>その他、運営が不適切と判断する行為</li>
            </ul>
          </Section>

          <Section title="第9条（利用停止および退会）">
            <ul>
              <li>当社は利用者が本規約に違反した場合、事前通知なく利用停止または退会処理を行うことがあります。</li>
              <li>利用者は当社所定の方法によりいつでも退会（登録抹消）を申請できます。</li>
              <li>サポーターは本サービスを通して知ったSOSユーザーに対して、サポーターが利用停止中または退会後に当該SOSユーザーに連絡を取ることは原則認められません。</li>
            </ul>
          </Section>

          <Section title="第10条（プラットフォームの中立性）">
            <ul>
              <li>本サービスは、SOSユーザーとサポーターとの間の支援機会を提供するプラットフォームです。</li>
              <li>支援内容や効果、マッチングの成立等を当社が保証するものではありません。</li>
              <li>SOSユーザーは、いつでも相談を取り下げ・終了することができます。</li>
              <li>サポーターは、正当な理由なく相談を放棄しないよう努めてください。</li>
            </ul>
          </Section>

          <Section title="第11条（利用者間の問題）">
            <p>
              利用者間で発生した紛争または問題等については、当該利用者間で誠実に解決するものとします。当社は当該トラブルについて責任を負いません。
            </p>
          </Section>

          <Section title="第12条（免責事項）">
            <ul>
              <li>当社は、本サービスの内容、機能、正確性、完全性、有用性または特定目的への適合性について保証するものではありません。</li>
              <li>本サービスの提供の中断、停止、変更または終了により生じた損害について、当社は当社の故意または重大な過失がない限り責任を負いません。</li>
              <li>本サービスではAI（人工知能）等を用いた分析、推薦または情報提供機能を提供する場合があります。これらの情報は参考情報として提供されるものであり、その正確性または完全性について当社は保証するものではありません。</li>
              <li>当社はサポーターとSOSホルダー間の取引には関与せず責任を負いません。また、サポーターの業務遂行上の瑕疵について当社は一切責任を負いません。</li>
              <li>
                <strong className="text-red-600">本サービスは緊急時の相談窓口ではありません。</strong>生命・身体に危険が及ぶ緊急事態は、警察（110）・救急（119）・よりそいホットライン（0120-279-338）などにご連絡ください。
              </li>
            </ul>
          </Section>

          <Section title="第13条（損害賠償の制限）">
            <p>
              当社が利用者に対して負う損害賠償責任は、当該利用者が当社に支払った直近1年間の利用料金を上限とします。
            </p>
          </Section>

          <Section title="第14条（反社会的勢力の排除）">
            <p>
              利用者は、自ら（及び団体登録者の場合はその役員・従業員等含む）が反社会的勢力に該当せず、また反社会的勢力に対して資金提供、便宜供与等を行わないことを表明し保証します。万一、当該事実が判明した場合、当社は直ちに利用停止または契約解除できるものとし、これに伴う一切の損害賠償を当該者が負担します。
            </p>
          </Section>

          <Section title="第15条（サービス内容の変更および終了）">
            <ul>
              <li>当社は、事前の通知なくサービス内容の変更・追加・停止・終了を行う場合があります。</li>
              <li>システムメンテナンス・不可抗力によるサービス停止について、運営は責任を負いません。</li>
              <li>重要な変更がある場合は、登録メールアドレスへの通知またはサービス内告知を行います。</li>
            </ul>
          </Section>

          <Section title="第16条（規約の変更）">
            <p>
              当社は必要に応じて本規約を変更することがあります。変更後の規約は本サービス上に掲載された時点から効力を生じます。改定後も本サービスをご利用になった場合、改定後の規約に同意したものとみなします。
            </p>
          </Section>

          <Section title="第17条（準拠法および管轄）">
            <p>
              本規約の解釈・適用は日本法に準拠します。本サービスに関する紛争については熊本地方裁判所を第一審の専属管轄裁判所とします。
            </p>
          </Section>

          <div className="pt-8 border-t border-gray-100 text-sm text-gray-400">
            <p>制定日：2026年4月1日　／　最終更新日：{UPDATED}</p>
            <p className="mt-1">明日もsamasama 運営チーム</p>
          </div>
        </div>
      </main>

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
      <div className="space-y-4 text-sm text-gray-600 leading-8">{children}</div>
    </section>
  )
}
