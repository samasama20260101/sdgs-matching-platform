'use client';

// Staging の入口(本番には出ない。src/proxy.ts が DEV_PASSWORD のある環境だけここへ回す)。運営の画面と同じく日本語だけ
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mark } from '@/components/app/Mark';
import { Button, Card, ErrorNote, Heading, Lead, TextField } from '@/components/app/ui';

export default function DevLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    const res = await fetch('/api/dev-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
    } else {
      setError(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-steel-faint text-ink">
      <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center gap-4 px-4 py-10">
        <span className="flex items-center gap-2.5">
          <Mark />
          <span className="font-heading text-[16px] font-bold">明日もsamasama</span>
        </span>
        <Card tone="support" className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Heading level={2}>開発環境</Heading>
              <Lead>入るにはパスワードが要ります。</Lead>
            </div>
            <TextField label="パスワード" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <ErrorNote>{error ? 'パスワードが違います' : null}</ErrorNote>
            <Button type="submit" tone="support" disabled={isLoading || !password}>
              {isLoading ? '確かめています…' : '入る'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
