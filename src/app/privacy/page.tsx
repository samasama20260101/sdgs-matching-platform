import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

export const metadata = { title: 'プライバシーポリシー | 明日もsamasama' }

const UPDATED = '2026年4月1日'

export default function PrivacyPage() {
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
          <p className="text-xs text-teal-600 font-mono tracking-[4px] uppercase mb-3">Privacy Policy</p>
          <h1 className="text-3xl font-black text-gray-900 mb-2">プライバシーポリシー</h1>
          <p className="text-sm text-gray-400">最終更新日：{UPDATED}</p>
        </div>

        <div className="space-y-10 text-gray-700">

          <section>
            <p className="text-sm leading-8">
              明日もsamasama運営チーム（以下「運営」）は、本サービスの利用者の個人情報保護を重要な責務と考えています。本プライバシーポリシーは、運営がどのような情報をどのように収集・利用・管理するかを説明するものです。
            </p>
          </section>

          <Section title="1. 収集する情報">
            <p>運営は以下の情報を収集します。</p>

            <SubSection label="登録時に収集する情報">
              <ul>
                <li>メールアドレス</li>
                <li>氏名またはニックネーム・表示名</li>
                <li>性別・生年月日</li>
                <li>電話番号（任意）</li>
                <li>居住地域・活動地域</li>
                <li>サポーターの場合：団体名・活動内容・SDGsゴール等</li>
              </ul>
            </SubSection>

            <SubSection label="利用中に収集する情報">
              <ul>
                <li>相談内容・メッセージのテキスト</li>
                <li>マッチング履歴・ケースの進捗状況</li>
                <li>アクセスログ（IPアドレス・ブラウザ情報・閲覧ページ等）</li>
                <li>AIによる相談内容の分析結果（カテゴリ・緊急度スコア等）</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="2. 情報の利用目的">
            <p>収集した情報は以下の目的にのみ使用します。</p>
            <ul>
              <li>本サービスの提供・運営・改善</li>
              <li>SOSユーザーとサポーターのマッチング精度向上</li>
              <li>AIによる相談内容の分析・カテゴリ分類</li>
              <li>ユーザーへのサービス通知・お知らせの送信</li>
              <li>不正利用・規約違反の防止・調査</li>
              <li>統計データの作成（個人を特定できない形式）</li>
            </ul>
          </Section>

          <Section title="3. 個人情報の保護（SOSユーザー向け）">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 text-sm text-teal-800 leading-7">
              <p className="font-bold mb-2">🔒 重要：承認前は個人情報を渡しません</p>
              <p>
                SOSユーザーの氏名・連絡先等の個人情報は、当該ユーザーが明示的に「マッチングを承認」するまで、サポーターに一切開示されません。相談内容の要約のみがサポーターに表示されます。
              </p>
            </div>
          </Section>

          <Section title="4. 第三者への提供">
            <p>運営は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
            <ul>
              <li>ユーザー本人の同意がある場合</li>
              <li>法令に基づき開示が求められた場合</li>
              <li>人の生命・身体・財産の保護のために緊急に必要な場合</li>
            </ul>
            <p>
              個人情報を広告目的で第三者に販売・提供することは一切行いません。
            </p>
          </Section>

          <Section title="5. 委託先・外部サービスの利用">
            <p>本サービスは以下の外部サービスを利用しており、各サービスのプライバシーポリシーが適用されます。</p>
            <ul>
              <li><strong>Supabase</strong>（データベース・認証）— データはセキュアなクラウド環境で管理されます</li>
              <li><strong>Vercel</strong>（ホスティング）— サーバーログを含むアクセス情報が収集される場合があります</li>
              <li><strong>Google Gemini AI</strong>（相談内容の分析）— 送信されるテキストはGoogleのポリシーに従い処理されます</li>
            </ul>
          </Section>

          <Section title="6. Cookieの使用">
            <p>
              本サービスはセッション管理のためにCookieを使用します。Cookieにはユーザーを識別する情報のみが含まれ、ブラウザの設定でCookieを無効にすることができますが、一部の機能が利用できなくなる場合があります。
            </p>
          </Section>

          <Section title="7. データの保存期間">
            <ul>
              <li>アカウント情報：退会から1年間保持した後、削除します</li>
              <li>相談・メッセージ履歴：ケース終了から2年間保持した後、削除します</li>
              <li>アクセスログ：最大90日間保持します</li>
              <li>法令上の保存義務がある情報は、定められた期間保持します</li>
            </ul>
          </Section>

          <Section title="8. ユーザーの権利">
            <p>ユーザーは以下の権利を有します。</p>
            <ul>
              <li><strong>開示請求：</strong>自身の個人情報の開示を求めることができます</li>
              <li><strong>訂正・削除：</strong>不正確な情報の訂正や削除を求めることができます</li>
              <li><strong>利用停止：</strong>個人情報の利用停止を求めることができます</li>
              <li><strong>退会：</strong>いつでもアカウントを削除することができます</li>
            </ul>
            <p>これらの請求は、お問い合わせフォームからご連絡ください。</p>
          </Section>

          <Section title="9. セキュリティ">
            <p>
              運営は個人情報への不正アクセス・紛失・破損・改ざん・漏洩を防ぐため、適切な技術的・組織的措置を講じます。ただし、インターネット経由のデータ送信には固有のリスクが伴い、完全な安全性を保証するものではありません。
            </p>
          </Section>

          <Section title="10. 子どものプライバシー">
            <p>
              本サービスは18歳未満の方が利用する場合、保護者の同意を必要とします。未成年者の個人情報を意図せず収集した場合、確認後速やかに削除します。
            </p>
          </Section>

          <Section title="11. ポリシーの改定">
            <p>
              本ポリシーは、法令の改正やサービスの変更に伴い改定することがあります。重要な変更がある場合はサービス内または登録メールアドレスへの通知を行います。
            </p>
          </Section>

          <Section title="12. お問い合わせ">
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

      {/* フッター */}
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
