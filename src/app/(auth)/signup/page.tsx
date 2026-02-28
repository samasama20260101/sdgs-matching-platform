'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep] = useState<'account' | 'profile'>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: アカウント情報
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2: プロフィール情報
  const [realName, setRealName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')

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
    setStep('profile')
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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
        <h1 className="text-center text-3xl font-bold text-gray-900">
          SDGsマッチング
        </h1>
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
              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'account' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'}`}>
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
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition"
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
                  本名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  表示名（省略時は本名を使用）
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