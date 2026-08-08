'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/icons/Logo'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

// カテゴリはDB保存・管理画面表示のため日本語文字列を正本とする（valueは日本語のまま）。
// 表示ラベルのみ landing.contact.categories.* で翻訳する。
const CATEGORY_DEFS = {
  guest: [
    { id: 'aboutService', ja: 'サービスについて知りたい' },
    { id: 'joinAsSupporter', ja: '支援団体として参加したい' },
    { id: 'media', ja: '取材・メディア' },
    { id: 'other', ja: 'その他' },
  ],
  SOS: [
    { id: 'howto', ja: '使い方がわからない' },
    { id: 'stuck', ja: '相談が進まない・困っている' },
    { id: 'matchingComplaint', ja: 'マッチングに不満がある' },
    { id: 'withdraw', ja: '退会希望' },
    { id: 'other', ja: 'その他' },
  ],
  SUPPORTER: [
    { id: 'howto', ja: '使い方がわからない' },
    { id: 'aboutCases', ja: '案件・マッチングについて' },
    { id: 'withdraw', ja: '退会希望' },
    { id: 'other', ja: 'その他' },
  ],
} as const;

const WITHDRAW_JA = '退会希望';

type ContactUser = {
  role: 'SOS' | 'SUPPORTER' | 'ADMIN';
  email: string;
  display_id?: string | null;
  access_token: string;
};

export default function ContactPage() {
  const t = useTranslations('landing.contact');
  const tForm = useTranslations('common.form');
  const [userData, setUserData] = useState<ContactUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // フォーム
  const [name, setName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState(false);
  const [doneId, setDoneId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      // getSession() がnullを返す場合があるため、refreshSession() でフォールバック
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        session = refreshData.session;
      }
      if (session) {
        const res = await fetch('/api/auth/get-role', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.user) setUserData({ ...data.user, access_token: session.access_token } as ContactUser);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const role: 'guest' | 'SOS' | 'SUPPORTER' =
    userData?.role === 'SOS' ? 'SOS' :
    userData?.role === 'SUPPORTER' ? 'SUPPORTER' : 'guest';

  const categories = CATEGORY_DEFS[role];

  const isRetirement = category === WITHDRAW_JA;
  const messagePlaceholder = isRetirement
    ? t('withdrawPlaceholder')
    : t('detailPlaceholder');

  const handleSubmit = async () => {
    setError('');
    if (role === 'guest' && !name.trim()) { setError(t('errorName')); return; }
    if (role === 'guest' && !guestEmail.trim()) { setError(t('errorEmail')); return; }
    if (!category) { setError(t('errorCategory')); return; }
    if (!message.trim()) { setError(t('errorDetail')); return; }
    if (message.length > 1000) { setError(t('errorDetailTooLong')); return; }

    setIsSending(true);
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: role === 'guest' ? name.trim() : null,
        email: userData?.email || guestEmail,
        organization: role === 'guest' ? organization.trim() || null : null,
        phone: role === 'guest' ? phone.trim() || null : null,
        category,
        message: message.trim(),
        access_token: userData?.access_token || null,
      }),
    });
    const result = await res.json();
    if (!res.ok) { setError(result.error || t('errorSend')); setIsSending(false); return; }
    setDoneId(result.display_id);
    setDone(true);
    setIsSending(false);
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">{tForm('loading')}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="no-underline">
            <Logo variant="default" size="sm" showText={true} />
          </Link>
          <div className="flex items-center gap-3">
            {userData && (
              <span className="text-xs text-gray-400 max-w-[35vw] truncate">
                {t('loggedInAs', { name: userData.display_id || userData.email })}
              </span>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* 戻るリンク */}
        {userData?.role === 'SOS' && <Link href="/sos/dashboard" className="text-xs text-gray-400 hover:text-teal-500">{t('backToDashboard')}</Link>}
        {userData?.role === 'SUPPORTER' && <Link href="/supporter/dashboard" className="text-xs text-gray-400 hover:text-teal-500">{t('backToDashboard')}</Link>}
        {!userData && <Link href="/" className="text-xs text-gray-400 hover:text-teal-500">{t('backToTop')}</Link>}

        <h1 className="text-2xl font-black text-gray-800 mt-3 mb-1">{t('title')}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {t('subtitle')}
        </p>

        {done ? (
          /* 完了画面 */
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{t('doneTitle')}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('doneBody')}
            </p>
            <div className="inline-block bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm text-gray-600 mb-6">
              {t('receiptNumber')}<strong className="font-mono text-gray-800">{doneId}</strong>
            </div>
            <div className="flex justify-center gap-3">
              {userData?.role === 'SOS' && <Link href="/sos/dashboard" className="px-5 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600">{t('toDashboard')}</Link>}
              {userData?.role === 'SUPPORTER' && <Link href="/supporter/dashboard" className="px-5 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600">{t('toDashboard')}</Link>}
              {!userData && <Link href="/" className="px-5 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600">{t('toTop')}</Link>}
            </div>
          </div>
        ) : (
          /* フォーム */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">

            {/* ログイン状態表示 */}
            {userData && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-700">
                {t('loggedInNote', { name: userData.display_id || userData.email })}
              </div>
            )}

            {/* 未ログイン：名前・組織・電話 */}
            {role === 'guest' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('nameLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    maxLength={64}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {tForm('email')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email" value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    maxLength={254}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('orgLabel')} <span className="text-xs text-gray-400 font-normal">{t('optional')}</span>
                  </label>
                  <input
                    type="text" value={organization} onChange={e => setOrganization(e.target.value)}
                    placeholder={t('orgPlaceholder')}
                    maxLength={64}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {t('phoneLabel')} <span className="text-xs text-gray-400 font-normal">{t('optional')}</span>
                  </label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder={t('phonePlaceholder')}
                    maxLength={20}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </>
            )}

            {/* カテゴリ */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('categoryLabel')} <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white appearance-none cursor-pointer"
              >
                <option value="">{t('categoryPlaceholder')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.ja}>{t(`categories.${cat.id}`)}</option>
                ))}
              </select>
              {isRetirement && (
                <p className="mt-2 text-xs text-red-500">{t('withdrawNote')}</p>
              )}
            </div>

            {/* 詳細 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('detailLabel')} <span className="text-red-500">*</span>
              </label>

              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder={messagePlaceholder}
                rows={5}
                maxLength={1000}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
              />
              <div className={'text-right text-xs mt-1 ' + (message.length >= 900 ? 'text-orange-500' : 'text-gray-400')}>
                {message.length} / 1000
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSending}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-blue-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
              {isSending ? tForm('submitting') : t('submit')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
