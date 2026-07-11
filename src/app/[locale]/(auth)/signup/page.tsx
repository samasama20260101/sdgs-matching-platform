'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Logo } from '@/components/icons/Logo'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher'
import { supabase } from '@/lib/supabase/client'

const PENDING_SOS_SIGNUP_KEY = 'samasama_pending_sos_signup'

export default function SignupPage() {
  const t = useTranslations('auth.signup')
  const tAuth = useTranslations('auth.common')
  const tForm = useTranslations('common.form')
  const tActions = useTranslations('common.actions')
  const router = useRouter()
  const locale = useLocale()

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

    if (password.length < 8) {
      setError(t('errorPwTooShort'))
      return
    }
    if (password.length > 64) {
      setError(t('errorPwTooLong'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('errorPwMismatch'))
      return
    }
    if (!agreed) {
      setError(t('errorAgreement'))
      return
    }
    setStep('profile')
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!gender) { setError(t('errorGenderRequired')); return }
    const [by, bm, bd] = birthDate.split('-')
    if (!by || !bm || !bd) { setError(t('errorBirthRequired')); return }
    if (realName.length > 64) { setError(t('errorNameTooLong')); return }
    if (displayName.length > 64) { setError(t('errorDisplayTooLong')); return }

    // 電話番号：ハイフン・スペース・括弧を除去して数字のみに
    const sanitizedPhone = phone.replace(/[-\s().+]/g, '')
    if (sanitizedPhone && sanitizedPhone.length > 15) {
      setError(t('errorPhoneTooLong'))
      return
    }

    setLoading(true)

    try {
      // 1. Supabase Auth にサインアップ
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error(t('errorSignupFailed'))

      const pendingProfile = {
        email: email.trim().toLowerCase(),
        real_name: realName,
        display_name: displayName || realName,
        phone: sanitizedPhone || null,
        gender,
        birth_date: birthDate,
        locale,
      }

      if (authData.session?.access_token) {
        // 2. users テーブルにレコード作成（APIルート経由 / supabaseAdmin使用）
        const profileRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`,
          },
          body: JSON.stringify({
            auth_user_id: authData.user.id,
            ...pendingProfile,
          }),
        })

        if (!profileRes.ok) {
          const profileData = await profileRes.json()
          // 登録上限エラーは専用メッセージを使用
          throw new Error(profileData.message || profileData.error || t('errorProfileSave'))
        }
        localStorage.removeItem(PENDING_SOS_SIGNUP_KEY)
      } else {
        localStorage.setItem(PENDING_SOS_SIGNUP_KEY, JSON.stringify(pendingProfile))
      }

      // Email Confirm がONの場合（本番）は session が null になる
      // → メール確認待ち画面へ
      // Email Confirm がOFFの場合（開発）は session がある
      // → そのままダッシュボードへ
      if (!authData.session) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`)
      } else {
        router.push('/sos/dashboard')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errorGeneric')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 transition-colors">
            {tAuth('backToTop')}
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="flex justify-center mb-4">
          <Logo variant="default" size="md" showText={true} />
        </div>
        <h2 className="mt-2 text-center text-xl text-gray-600">
          {t('title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          {t('supporterNote')}
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
              {t('step1')}
            </div>
            <div className="flex-1 h-px bg-gray-300 mx-2" />
            <div className={`flex-1 text-center text-sm font-medium ${step === 'profile' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'profile' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
                2
              </div>
              {t('step2')}
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
                  {tForm('email')}
                </label>
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('passwordLabel')}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={64}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400 text-right">{t('charCount', { count: password.length, max: 64 })}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('confirmLabel')}
                </label>
                <input
                  type="password"
                  required
                  maxLength={64}
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
                    {tAuth.rich('agreement', {
                      terms: (chunks) => (
                        <Link href="/terms" target="_blank" rel="noopener noreferrer"
                          className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                          className="text-teal-600 font-medium underline underline-offset-2 hover:text-teal-700">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
              </div>
              <button
                type="submit"
                disabled={!agreed}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {tActions('next')}
              </button>
            </form>
          )}

          {/* Step 2: プロフィール */}
          {step === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('nameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-1 flex justify-between">
                  <p className="text-xs text-gray-500">{t('nameNote')}</p>
                  <p className={`text-xs flex-shrink-0 ml-2 ${realName.length >= 60 ? 'text-orange-500' : 'text-gray-400'}`}>{t('charCount', { count: realName.length, max: 64 })}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('displayNameLabel')}
                </label>
                <input
                  type="text"
                  maxLength={64}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={realName}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className={`mt-1 text-xs text-right ${displayName.length >= 60 ? 'text-orange-500' : 'text-gray-400'}`}>{t('charCount', { count: displayName.length, max: 64 })}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('genderLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex gap-3">
                  {([
                    { value: 'MALE', label: t('genderMale') },
                    { value: 'FEMALE', label: t('genderFemale') },
                    { value: 'OTHER', label: t('genderOther') },
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
                  {t('birthLabel')} <span className="text-red-500">*</span>
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
                    <option value="">{t('yearPlaceholder')}</option>
                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={birthDate.split('-')[1] || ''}
                    onChange={(e) => {
                      const [y, , d] = birthDate.split('-')
                      setBirthDate(`${y || ''}-${e.target.value}-${d || ''}`)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                  >
                    <option value="">{t('monthPlaceholder')}</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{Number(m)}</option>
                    ))}
                  </select>
                  <select
                    value={birthDate.split('-')[2] || ''}
                    onChange={(e) => {
                      const [y, m] = birthDate.split('-')
                      setBirthDate(`${y || ''}-${m || ''}-${e.target.value}`)
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                  >
                    <option value="">{t('dayPlaceholder')}</option>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                      <option key={d} value={d}>{Number(d)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('phoneLabel')}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  maxLength={20}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">{t('phoneNote')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('account')}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-50 transition"
                >
                  {tActions('back')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? t('submitting') : t('submit')}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            {t('haveAccount')}{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              {t('loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
