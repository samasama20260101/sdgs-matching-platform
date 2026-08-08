// src/app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ForgotPasswordPage() {
    const t = useTranslations('auth.forgot');
    const tAuth = useTranslations('auth.common');
    const tForm = useTranslations('common.form');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetError) {
                setError(t('errorSendFailed'));
                return;
            }
            setIsSent(true);
        } catch {
            setError(t('errorSendFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    if (isSent) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1 text-center">
                        <div className="text-5xl mb-2">📧</div>
                        <CardTitle className="text-2xl font-bold">{t('sentTitle')}</CardTitle>
                        <CardDescription className="text-base">
                            {t('sentDescription')}<br />
                            <span className="font-medium text-gray-700">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 space-y-1.5">
                            <p>・{t('noteSpam')}</p>
                            <p>・{t('noteExpiry')}</p>
                            <p>・{t('noteSender')}</p>
                        </div>
                        <div className="text-center text-sm text-gray-500">
                            {t('resendPrompt')}{' '}
                            <button
                                onClick={() => setIsSent(false)}
                                className="text-blue-600 hover:underline font-medium">
                                {t('resendAction')}
                            </button>
                        </div>
                        <div className="text-center pt-2">
                            <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                                {tAuth('backToLogin')}
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="text-center text-4xl mb-2">🔑</div>
                    <CardTitle className="text-2xl font-bold text-center">
                        {t('title')}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {t('description')}
                    </CardDescription>
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
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                maxLength={254}
                            />
                        </div>
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                            disabled={isLoading}>
                            {isLoading ? tForm('submitting') : t('submit')}
                        </Button>
                    </form>
                    <div className="mt-4 text-center">
                        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                            {tAuth('backToLogin')}
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
