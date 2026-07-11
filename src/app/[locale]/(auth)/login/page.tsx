// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { withLocalePath } from '@/i18n/routing';
import { Logo } from '@/components/icons/Logo';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';

const PENDING_SOS_SIGNUP_KEY = 'samasama_pending_sos_signup'

type PendingSosSignupProfile = {
    email: string
    real_name: string
    display_name: string
    phone: string | null
    gender: 'MALE' | 'FEMALE' | 'OTHER'
    birth_date: string
}

export default function LoginPage() {
    const t = useTranslations('auth.login');
    const tAuth = useTranslations('auth.common');
    const tForm = useTranslations('common.form');
    const locale = useLocale();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    // URLパラメータで停止メッセージを表示
    const searchParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search) : null;
    const suspendedMsg = searchParams?.get('reason') === 'suspended'
      ? t('errorSuspended') : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // 1. ログイン
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (authError) {
                // BANされたユーザーはSupabaseが "User is banned" を返す
                if (authError.message?.toLowerCase().includes('banned') || authError.message?.toLowerCase().includes('ban')) {
                    setError(t('errorSuspended'));
                } else {
                    setError(t('errorInvalidCredentials'));
                }
                return;
            }

            // 2. API経由でロール取得（RLSをバイパス）
            const res = await fetch('/api/auth/get-role', {
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
            });

            // ログイン成功後でも停止されている場合（フラグのみ停止）
            if (res.status === 403) {
                await supabase.auth.signOut();
                setError(t('errorSuspended'));
                return;
            }

            const result = await res.json();

            if (!result.role) {
                const pendingRaw = localStorage.getItem(PENDING_SOS_SIGNUP_KEY)
                const pendingProfile = pendingRaw ? JSON.parse(pendingRaw) as PendingSosSignupProfile : null
                if (pendingProfile?.email === formData.email.trim().toLowerCase()) {
                    const profileRes = await fetch('/api/auth/signup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${data.session.access_token}`,
                        },
                        body: JSON.stringify(pendingProfile),
                    })
                    if (!profileRes.ok) {
                        const profileData = await profileRes.json()
                        setError(profileData.message || profileData.error || t('errorProfileSave'));
                        return;
                    }
                    localStorage.removeItem(PENDING_SOS_SIGNUP_KEY)
                    window.location.href = withLocalePath(locale, '/sos/dashboard');
                    return;
                }
                setError(t('errorUserFetch'));
                return;
            }

            // 3. ロール別リダイレクト
            if (result.user?.must_change_password) {
                window.location.href = withLocalePath(locale, '/change-password')
            } else if (result.role === 'SOS') {
                window.location.href = withLocalePath(locale, '/sos/dashboard');
            } else if (result.role === 'SUPPORTER') {
                window.location.href = withLocalePath(locale, '/supporter/dashboard');
            } else if (result.role === 'ADMIN') {
                window.location.href = withLocalePath(locale, '/admin/dashboard');
            } else {
                window.location.href = withLocalePath(locale, '/');
            }

        } catch (err) {
            console.error('Login error:', err);
            setError(t('errorGeneric'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-4 flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 transition-colors">
                        {tAuth('backToTop')}
                    </Link>
                    <LanguageSwitcher />
                </div>
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-3">
                    <div className="flex justify-center pt-2">
                        <Logo variant="default" size="md" showText={true} />
                    </div>
                    <CardTitle className="text-xl font-bold text-center text-gray-700">
                        {t('title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">

                        <div className="space-y-2">
                            <Label htmlFor="email">
                                {tForm('email')} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder={tAuth('emailPlaceholder')}
                                maxLength={254}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">
                                {tForm('password')} <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={t('passwordPlaceholder')}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {suspendedMsg && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium">
                                🚫 {suspendedMsg}
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                            disabled={isLoading}
                        >
                            {isLoading ? t('submitting') : t('submit')}
                        </Button>

                    </form>

                    <div className="mt-4 space-y-2 text-center text-sm text-gray-600">
                        <div>
                            {t('noAccount')}{' '}
                            <Link href="/signup" className="text-blue-600 hover:underline">
                                {t('signupLink')}
                            </Link>
                        </div>
                        <div>
                            <Link href="/forgot-password" className="text-blue-600 hover:underline">
                                {t('forgotLink')}
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>
            </div>
        </div>
    );
}
