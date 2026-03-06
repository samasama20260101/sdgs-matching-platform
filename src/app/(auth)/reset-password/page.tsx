// src/app/(auth)/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') setIsReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password.length < 8) { setError('パスワードは8文字以上で入力してください'); return; }
        if (password !== confirm) { setError('パスワードが一致しません'); return; }
        setIsLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
                setError('パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。');
                return;
            }
            setIsDone(true);
            setTimeout(() => router.replace('/login'), 3000);
        } catch { setError('エラーが発生しました。もう一度お試しください。'); }
        finally { setIsLoading(false); }
    };

    if (isDone) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="text-5xl mb-2">✅</div>
                    <CardTitle className="text-2xl font-bold">パスワードを更新しました</CardTitle>
                    <CardDescription>3秒後にログイン画面へ移動します</CardDescription>
                </CardHeader>
                <CardContent className="text-center pt-2">
                    <Button onClick={() => router.replace('/login')}
                        className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700">
                        今すぐログインへ →
                    </Button>
                </CardContent>
            </Card>
        </div>
    );

    if (!isReady) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardContent className="pt-10 pb-8 text-center text-gray-400">
                    <div className="text-4xl mb-3 animate-pulse">🔑</div>
                    <p>リンクを確認中...</p>
                    <p className="text-xs mt-2">しばらくお待ちください</p>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="text-center text-4xl mb-2">🔐</div>
                    <CardTitle className="text-2xl font-bold text-center">新しいパスワードを設定</CardTitle>
                    <CardDescription className="text-center">新しいパスワードを入力してください</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">新しいパスワード <span className="text-red-500">*</span></Label>
                            <Input id="password" type="password" placeholder="8文字以上"
                                value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">パスワード（確認） <span className="text-red-500">*</span></Label>
                            <Input id="confirm" type="password" placeholder="もう一度入力してください"
                                value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                        </div>
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
                        )}
                        <Button type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700"
                            disabled={isLoading}>
                            {isLoading ? '更新中...' : 'パスワードを更新する'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}