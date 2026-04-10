'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const EyeIcon = ({ show }: { show: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
        strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        {show ? (
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        ) : (
            <>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </>
        )}
    </svg>
);

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

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
                if (updateError.message.includes('same password') || updateError.message.includes('different')) {
                    setError('以前と同じパスワードは使用できません。別のパスワードを設定してください。');
                } else {
                    setError('パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。');
                }
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
                    <CardDescription className="text-center">以前とは異なるパスワードを入力してください</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">新しいパスワード <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Input id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="8文字以上"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required maxLength={64} className="pr-10" />
                                <button type="button" onClick={() => setShowPassword(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <EyeIcon show={showPassword} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">パスワード（確認） <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Input id="confirm"
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="もう一度入力してください"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required maxLength={64} className="pr-10" />
                                <button type="button" onClick={() => setShowConfirm(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <EyeIcon show={showConfirm} />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">※ 以前と同じパスワードは使用できません</p>
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
