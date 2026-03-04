// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

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
                setError('メールアドレスまたはパスワードが正しくありません');
                return;
            }

            // 2. API経由でロール取得（RLSをバイパス）
            const res = await fetch('/api/auth/get-role', {
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
            });
            const result = await res.json();

            if (!result.role) {
                setError('ユーザー情報の取得に失敗しました');
                return;
            }

            // 3. ロール別リダイレクト
            if (result.user?.must_change_password) {
                window.location.href = '/change-password'
            } else if (result.role === 'SOS') {
                window.location.href = '/sos/dashboard';
            } else if (result.role === 'SUPPORTER') {
                window.location.href = '/supporter/dashboard';
            } else if (result.role === 'ADMIN') {
                window.location.href = '/admin/dashboard';
            } else {
                window.location.href = '/';
            }

        } catch (err) {
            console.error('Login error:', err);
            setError('ログイン中にエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-4">
                    <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 transition-colors">
                        ← トップページに戻る
                    </Link>
                </div>
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">
                        ログイン
                    </CardTitle>
                    <CardDescription className="text-center">
                        SDGsマッチングプラットフォーム
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
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">
                                パスワード <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="パスワードを入力"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                            className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                            disabled={isLoading}
                        >
                            {isLoading ? 'ログイン中...' : 'ログイン'}
                        </Button>

                    </form>

                    <div className="mt-4 space-y-2 text-center text-sm text-gray-600">
                        <div>
                            アカウントをお持ちでない方は{' '}
                            <a href="/signup" className="text-blue-600 hover:underline">
                                新規登録
                            </a>
                        </div>
                        <div>
                            <a href="/forgot-password" className="text-blue-600 hover:underline">
                                パスワードを忘れた方
                            </a>
                        </div>
                    </div>
                </CardContent>
            </Card>
            </div>
        </div>
    );
}