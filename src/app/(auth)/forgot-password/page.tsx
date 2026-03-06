// src/app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ForgotPasswordPage() {
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
                setError('メールの送信に失敗しました。もう一度お試しください。');
                return;
            }
            setIsSent(true);
        } catch {
            setError('エラーが発生しました。もう一度お試しください。');
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
                        <CardTitle className="text-2xl font-bold">メールを送信しました</CardTitle>
                        <CardDescription className="text-base">
                            <span className="font-medium text-gray-700">{email}</span> に<br />
                            パスワード再設定のリンクを送りました
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 space-y-1.5">
                            <p>・メールが届かない場合は迷惑メールフォルダをご確認ください</p>
                            <p>・リンクの有効期限は1時間です</p>
                            <p>・送信元: noreply@mail.app.supabase.io</p>
                        </div>
                        <div className="text-center text-sm text-gray-500">
                            メールが届かない場合は{' '}
                            <button
                                onClick={() => setIsSent(false)}
                                className="text-blue-600 hover:underline font-medium">
                                再送信する
                            </button>
                        </div>
                        <div className="text-center pt-2">
                            <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                                ← ログインに戻る
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
                        パスワードをお忘れの方
                    </CardTitle>
                    <CardDescription className="text-center">
                        登録済みのメールアドレスを入力してください。<br />
                        パスワード再設定のリンクをお送りします。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">
                                メールアドレス <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="example@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
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
                            {isLoading ? '送信中...' : '再設定メールを送る'}
                        </Button>
                    </form>
                    <div className="mt-4 text-center">
                        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                            ← ログインに戻る
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}