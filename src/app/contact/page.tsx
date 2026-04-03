'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { Logo } from '@/components/icons/Logo';



const CATEGORIES = {
  guest: [
    'サービスについて知りたい',
    '支援団体として参加したい',
    '取材・メディア',
    'その他',
  ],
  SOS: [
    '使い方がわからない',
    '相談が進まない・困っている',
    'マッチングに不満がある',
    '退会希望',
    'その他',
  ],
  SUPPORTER: [
    '使い方がわからない',
    '案件・マッチングについて',
    '退会希望',
    'その他',
  ],
};

export default function ContactPage() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
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
        setAuthUser(session.user);
        const res = await fetch('/api/auth/get-role', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.user) setUserData({ ...data.user, access_token: session.access_token });
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const role: 'guest' | 'SOS' | 'SUPPORTER' =
    userData?.role === 'SOS' ? 'SOS' :
    userData?.role === 'SUPPORTER' ? 'SUPPORTER' : 'guest';

  const categories = CATEGORIES[role];

  const isRetirement = category === '退会希望';
  const messagePlaceholder = isRetirement
    ? '退会を希望される理由をお聞かせください（任意）'
    : 'お問い合わせの詳細をご記入ください';

  const handleSubmit = async () => {
    setError('');
    if (role === 'guest' && !name.trim()) { setError('お名前を入力してください'); return; }
    if (role === 'guest' && !guestEmail.trim()) { setError('メールアドレスを入力してください'); return; }
    if (!category) { setError('お問い合わせの種類を選択してください'); return; }
    if (!message.trim()) { setError('詳細を入力してください'); return; }
    if (message.length > 1000) { setError('詳細は1000文字以内で入力してください'); return; }

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
    if (!res.ok) { setError(result.error || '送信に失敗しました'); setIsSending(false); return; }
    setDoneId(result.display_id);
    setDone(true);
    setIsSending(false);
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">読み込み中...</p>
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
          {userData && (
            <span className="text-xs text-gray-400">
              {userData.display_id || userData.email} でログイン中
            </span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* 戻るリンク */}
        {userData?.role === 'SOS' && <Link href="/sos/dashboard" className="text-xs text-gray-400 hover:text-teal-500">← ダッシュボードに戻る</Link>}
        {userData?.role === 'SUPPORTER' && <Link href="/supporter/dashboard" className="text-xs text-gray-400 hover:text-teal-500">← ダッシュボードに戻る</Link>}
        {!userData && <Link href="/" className="text-xs text-gray-400 hover:text-teal-500">← トップに戻る</Link>}

        <h1 className="text-2xl font-black text-gray-800 mt-3 mb-1">お問い合わせ</h1>
        <p className="text-sm text-gray-500 mb-8">
          内容を確認後、ご登録のメールアドレスへご返信いたします。
        </p>

        {done ? (
          /* 完了画面 */
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">送信が完了しました</h2>
            <p className="text-sm text-gray-500 mb-4">
              担当者よりご返信いたします。今しばらくお待ちください。
            </p>
            <div className="inline-block bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm text-gray-600 mb-6">
              受付番号：<strong className="font-mono text-gray-800">{doneId}</strong>
            </div>
            <div className="flex justify-center gap-3">
              {userData?.role === 'SOS' && <Link href="/sos/dashboard" className="px-5 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600">ダッシュボードへ</Link>}
              {userData?.role === 'SUPPORTER' && <Link href="/supporter/dashboard" className="px-5 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600">ダッシュボードへ</Link>}
              {!userData && <Link href="/" className="px-5 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600">トップへ戻る</Link>}
            </div>
          </div>
        ) : (
          /* フォーム */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">

            {/* ログイン状態表示 */}
            {userData && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-700">
                <span className="font-medium">{userData.display_id || userData.email}</span> としてログイン中 — メールアドレスは自動的に使用されます
              </div>
            )}

            {/* 未ログイン：名前・組織・電話 */}
            {role === 'guest' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    お名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="山田 太郎"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email" value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    組織名 <span className="text-xs text-gray-400 font-normal">任意</span>
                  </label>
                  <input
                    type="text" value={organization} onChange={e => setOrganization(e.target.value)}
                    placeholder="〇〇株式会社"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    電話番号 <span className="text-xs text-gray-400 font-normal">任意</span>
                  </label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="03-0000-0000"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </>
            )}

            {/* カテゴリ */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                お問い合わせの種類 <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white appearance-none cursor-pointer"
              >
                <option value="">選択してください</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {category === '退会希望' && (
                <p className="mt-2 text-xs text-red-500">※ 退会をご希望の場合、担当者より手続きのご案内をメールにてお送りします</p>
              )}
            </div>

            {/* 詳細 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                詳細 <span className="text-red-500">*</span>
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
              {isSending ? '送信中...' : '送信する'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
