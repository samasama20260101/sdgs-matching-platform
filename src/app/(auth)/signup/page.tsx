'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'
import { supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep] = useState<'account' | 'profile'>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 同意チェック
  const [agreed, setAgreed] = useState(false)

  // Step 1: アカウント情報
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2: プロフィール情報
  const [realName, setRealName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('')
  const [birthDate, setBirthDate] = useState('')

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    if (!agreed) {
      setError('利用規約・プライバシーポリシーへの同意が必要です')
      return
    }
    setStep('profile')
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!gender) { setError('性別を選択してください'); return }
    const [by, bm, bd] = birthDate.split('-')
    if (!by || !bm || !bd) { setError('生年月日を選択してください'); return }

    setLoading(true)

    try {
      // 1. Supabase Auth にサインアップ
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('アカウント作成に失敗しました')

      // 2. users テーブルにレコード作成
      const { error: profileError } = await supabase.from('users').insert({
        auth_user_id: authData.user.id,
        role: 'SOS',
        real_name: realName,
        display_name: displayName || realName,
        email,
        phone: phone || null,
        gender,
        birth_date: birthDate,
      })

      if (profileError) throw profileError

      router.push('/sos/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-4 text-center">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 transition-colors">
            ← トップページに戻る
          </Link>
        </div>
        <div className="flex justify-center mb-4">
          <Logo variant="default" size="md" showText={true} />
        </div>
        <h2 className="mt-2 text-center text-xl text-gray-600">
          新規登録（相談者）
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          サポーター（NPO・企業）としての登録は
          <br />
          管理者にお問い合わせください
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* ステップインジケーター */}
          <div className="flex items-center mb-8">
            <div className={`flex-1 text-center text-sm font-medium ${step === 'account' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'account' ? 'bg-blue-600 text-white' : 'bg-teal-500 text-white'}`}>
                {step === 'profile' ? '✓' : '1'}
              </div>
              アカウント情報
            </div>
            <div className="flex-1 h-px bg-gray-300 mx-2" />
            <div className={`flex-1 text-center text-sm font-medium ${step === 'profile' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'profile' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
                2
              </div>
              プロフィール
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: アカウント情報 */}
          {step === 'account' && (
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  パスワード（8文字以上）
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 利用規約同意チェックボックス */}
              <div className="mt-2">
                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  agreed ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-teal-500 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-600 leading-6">
                    <a href="/terms" target="_blank" rel="noopener noreferrer"
                      className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                      利用規約
                    </a>
                    および
                    <a href="/privacy" target="_blank" rel="noopener noreferrer"
                      className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                      プライバシーポリシー
                    </a>
                    を読み、内容に同意します
                  </span>
                </label>
              </div>
              <button
                type="submit"
                disabled={!agreed}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                次へ
              </button>
            </form>
          )}

          {/* Step 2: プロフィール */}
          {step === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder="ニックネームでもOKです"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">※ニックネームでもOKです。マッチ後にサポーターへ共有されます（公開されません）</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  表示名（省略時はお名前を使用）
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={realName}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  性別 <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex gap-3">
                  {([
                    { value: 'MALE', label: '男性' },
                    { value: 'FEMALE', label: '女性' },
                    { value: 'OTHER', label: 'その他／答えない' },
                  ] as const).map(opt => (
                    <label key={opt.value}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md border text-sm cursor-pointer transition ${
                        gender === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      <input type="radio" name="gender" value={opt.value}
                        checked={gender === opt.value}
                        onChange={() => setGender(opt.value)}
                        className="sr-only" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  生年月日 <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex gap-2 items-center">
                  <select
                    value={birthDate.split('-')[0] || ''}
                    onChange={(e) => {
                      const [, m, d] = birthDate.split('-')
                      setBirthDate(`${e.target.value}-${m || ''}-${d || ''}`)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                  >
                    <option value="">年</option>
                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">年</span>
                  <select
                    value={birthDate.split('-')[1] || ''}
                    onChange={(e) => {
                      const [y, , d] = birthDate.split('-')
                      setBirthDate(`${y || ''}-${e.target.value}-${d || ''}`)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                  >
                    <option value="">月</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{Number(m)}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">月</span>
                  <select
                    value={birthDate.split('-')[2] || ''}
                    onChange={(e) => {
                      const [y, m] = birthDate.split('-')
                      setBirthDate(`${y || ''}-${m || ''}-${e.target.value}`)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                  >
                    <option value="">日</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                      <option key={d} value={d}>{Number(d)}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">日</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  電話番号（任意）
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('account')}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 transition"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            すでにアカウントをお持ちの方は{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}