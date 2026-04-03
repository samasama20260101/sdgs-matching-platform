import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

export const metadata = { title: 'プライバシーポリシー | 明日もsamasama' }

const UPDATED = '2026年4月1日'

export default function PrivacyPage() {
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
          <p className="text-xs text-teal-600 font-mono tracking-[4px] uppercase mb-3">Privacy Policy</p>
          <h1 className="text-3xl font-black text-gray-900 mb-2">プライバシーポリシー</h1>
          <p className="text-sm text-gray-400">最終更新日：{UPDATED}</p>
        </div>

        <div className="space-y-10 text-gray-700">

          <section>
            <p className="text-sm leading-8">
              合同会社ｓａｍａｓａｍａ（以下「当社」）は、当社が提供するサービス「明日もsamasama」（以下「本サービス」）において、利用者の個人情報保護を重要な責務と考えています。以下のプライバシーポリシー（以下「本ポリシー」）は、当社がどのような情報をどのように収集・利用・管理するかを説明するものです。
            </p>
          </section>

          <Section title="第1条（取得する情報）">
            <p>当社は、本サービスの提供にあたり、以下の情報を取得する場合があります。</p>
            <SubSection label="利用者が登録または入力する情報">
              <ul>
                <li>氏名またはニックネーム・表示名</li>
                <li>メールアドレス</li>
                <li>性別・生年月日</li>
                <li>電話番号</li>
                <li>居住地域・活動地域</li>
                <li>所属企業名または団体名</li>
                <li>プロフィール情報</li>
                <li>SDGsに関する関心分野や活動に関する情報</li>
                <li>SOS登録情報</li>
                <li>その他利用者が本サービス上で入力する情報</li>
              </ul>
            </SubSection>
            <SubSection label="サービス利用に伴い自動的に取得する情報">
              <ul>
                <li>Cookie</li>
                <li>端末情報</li>
                <li>アクセスログ（IPアドレス・ブラウザ情報・閲覧ページ等）</li>
                <li>利用履歴</li>
                <li>AIによる相談内容の分析結果（カテゴリ・緊急度スコア等）</li>
              </ul>
            </SubSection>
            <SubSection label="マッチング機能に関連して取得する情報">
              <ul>
                <li>活動履歴</li>
                <li>マッチング履歴、ケースの進捗状況</li>
                <li>利用者間のメッセージ履歴</li>
                <li>SOSの解決/未解決の結果やフィードバック</li>
                <li>有償サービス提供時の取引記録や決済情報</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="第2条（利用目的）">
            <p>当社は、取得した個人情報を以下の目的のために利用する場合があります。</p>
            <ul>
              <li>本サービスの提供、運営および改善</li>
              <li>マッチングの提供およびマッチング精度向上</li>
              <li>AIによる相談内容の分析・カテゴリ分類</li>
              <li>利用者に適した企業、活動またはプロジェクト、困りごとの紹介</li>
              <li>本サービスに関する連絡、通知およびサポート対応</li>
              <li>不正利用の防止およびサービスの安全性確保</li>
              <li>統計分析およびサービス品質の向上</li>
              <li>新サービス、イベント、キャンペーン等に関する案内</li>
              <li>法令または利用規約に違反する行為への対応</li>
            </ul>
          </Section>

          <Section title="第3条（個人情報の保護（SOSユーザー向け））">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 text-sm text-teal-800 leading-7">
              <p className="font-bold mb-2">🔒 重要：承認前は個人情報を渡しません</p>
              <p>
                SOSユーザーの氏名・連絡先等の個人情報は、当該ユーザーが明示的に「マッチングを承認」するまで、サポーターに一切開示されません。開示前には、相談内容の要約のみがサポーターに表示されます。
              </p>
            </div>
          </Section>

          <Section title="第4条（第三者への提供）">
            <p>当社は、次の場合を除き、利用者の個人情報を第三者に提供することはありません。決済事業者・配送業者等の委託先に提供する場合も、秘密保持契約の下で必要最小限にとどめます。</p>
            <ul>
              <li>利用者本人の同意がある場合</li>
              <li>SOSユーザーとサポーターとのマッチングを実現するため、必要な範囲でサポーターに情報を提供する場合</li>
              <li>法令に基づき開示を求められた場合</li>
              <li>人の生命、身体または財産の保護のために緊急に必要な場合</li>
              <li>公衆衛生の向上または児童の健全育成の推進のために必要がある場合</li>
              <li>国または地方公共団体の事務に協力する必要がある場合</li>
            </ul>
            <p>個人情報を広告目的で第三者に販売・提供することは一切行いません。</p>
          </Section>

          <Section title="第5条（委託先・外部サービスの利用）">
            <p>本サービスは以下の外部サービスを利用しており、各サービスのプライバシーポリシーが適用されます。</p>
            <ul>
              <li><strong>Supabase</strong>（データベース・認証）— データはセキュアなクラウド環境で管理されます</li>
              <li><strong>Vercel</strong>（ホスティング）— サーバーログを含むアクセス情報が収集される場合があります</li>
              <li><strong>Google Gemini AI</strong>（相談内容の分析）— 送信されるテキストはGoogleのポリシーに従い処理されます</li>
            </ul>
          </Section>

          <Section title="第6条（個人情報の取扱いの委託）">
            <p>
              当社は、本サービスの運営に必要な範囲において、個人情報の取扱いを第三者に委託する場合があります。この場合、当社は委託先に対し、個人情報が適切に管理されるよう必要かつ適切な監督を行います。
            </p>
          </Section>

          <Section title="第7条（Cookie等の利用）">
            <p>
              当社は、本サービスの利便性向上および利用状況の分析を目的として、Cookieおよび類似の技術を利用する場合があります。利用者はブラウザの設定によりCookieの利用を拒否することができますが、その場合、本サービスの一部機能が利用できなくなる可能性があります。
            </p>
          </Section>

          <Section title="第8条（利用者の権利）">
            <p>利用者は以下の権利を有します。</p>
            <ul>
              <li><strong>開示請求：</strong>自身の個人情報の開示を求めることができます</li>
              <li><strong>訂正・削除：</strong>不正確な情報の訂正や削除を求めることができます</li>
              <li><strong>利用停止：</strong>個人情報の利用停止を求めることができます</li>
              <li><strong>退会：</strong>いつでもアカウントを削除することができます</li>
            </ul>
            <p>これらの請求は、<Link href="/contact" className="text-teal-600 underline underline-offset-2">お問い合わせフォーム</Link>からご連絡ください。</p>
          </Section>

          <Section title="第9条（安全管理措置）">
            <p>
              当社は、個人情報の漏えい、紛失、改ざん、不正アクセス等を防止するため、合理的かつ適切な安全管理措置を講じ、個人情報を適切に管理します。ただし、インターネット経由のデータ送信には固有のリスクが伴い、完全な安全性を保証するものではありません。万が一情報漏洩発覚時には、個人情報保護委員会への報告と対象者への通知を行います。
            </p>
          </Section>

          <Section title="第10条（統計情報の利用）">
            <p>
              当社は、取得した情報を、個人を特定できない形式に加工した統計情報として作成し、本サービスの改善、研究または分析の目的で利用する場合があります。
            </p>
          </Section>

          <Section title="第11条（個人情報の保管期間）">
            <p>
              当社は、個人情報を利用目的の達成に必要な期間に限り保管し、その後は法令に従い適切な方法で削除または匿名化します。
            </p>
          </Section>

          <Section title="第12条（個人情報の開示・訂正・削除等）">
            <p>
              利用者は、当社が保有する自己の個人情報について、法令の定めに従い、開示、訂正、削除または利用停止を求めることができます。当社は、これらの請求があった場合、法令に基づき適切に対応します。
            </p>
          </Section>

          <Section title="第13条（未成年者の利用）">
            <p>
              未成年の利用者が本サービスを利用する場合は、保護者または法定代理人の同意を得たうえで利用するものとします。
            </p>
            <p>
              ただし、特別な環境に身を置く未成年が存在することを当社は認識しており、そのような方も含めて誰一人取り残さないことを目指します。よって、未成年で本サービス利用希望者は<Link href="/contact" className="text-teal-600 underline underline-offset-2">お問い合わせフォーム</Link>よりご連絡ください。内容次第とはなりますが、本サービスの利用を許可する場合があります。
            </p>
          </Section>

          <Section title="第14条（ポリシーの変更）">
            <p>
              当社は、必要に応じて本ポリシーの内容を変更することがあります。変更後の内容は、本サービス上に掲載した時点から効力を生じるものとします。重要な変更がある場合はサービス内または登録メールアドレスへの通知を行います。
            </p>
          </Section>

          <Section title="第15条（ポリシーの適用範囲）">
            <p>本ポリシーは以下を適用範囲外とします。</p>
            <ul>
              <li>サポーターが本サービスを通じずに利用者から取得した個人情報</li>
              <li>本サービスの利用者以外</li>
            </ul>
          </Section>

          <Section title="第16条（お問い合わせ）">
            <p>
              個人情報の取り扱いに関するご質問・ご要望は、<Link href="/contact" className="text-teal-600 underline underline-offset-2">お問い合わせフォーム</Link>よりご連絡ください。
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
          <Link href="/terms" className="hover:text-teal-600 transition-colors">利用規約</Link>
          <Link href="/privacy" className="text-teal-600 font-medium">プライバシーポリシー</Link>
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

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-gray-700 mb-2">▸ {label}</p>
      <div className="pl-3">{children}</div>
    </div>
  )
}
