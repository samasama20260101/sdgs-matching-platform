// src/components/layout/Header.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/Logo';

type UserRole = 'SOS' | 'SUPPORTER' | 'ADMIN' | null;

export default function Header() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUserInfo = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          if (isMounted) { setRole(null); setDisplayName(''); }
          return;
        }

        // API経由でロール取得（RLSをバイパス）
        const res = await fetch('/api/auth/get-role', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (isMounted && data.user) {
          setRole(data.role as UserRole);
          setDisplayName(data.user.real_name || data.user.display_name || '');
        }
      } catch (e) {
        console.error('[Header] loadUserInfo error:', e);
        if (isMounted) { setRole(null); setDisplayName(''); }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadUserInfo();
    return () => { isMounted = false; };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const getDashboardLink = () => {
    if (role === 'SOS') return '/sos/dashboard';
    if (role === 'SUPPORTER') return '/supporter/dashboard';
    if (role === 'ADMIN') return '/admin/dashboard';
    return '/';
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href={getDashboardLink()} className="flex items-center">
          <Logo variant="default" size="sm" showText={true} />
        </Link>

        {!isLoading && (
          <nav className="flex items-center gap-4">
            {role ? (
              <>
                <Link href={getDashboardLink()} className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  ダッシュボード
                </Link>

                {role === 'SOS' && (
                  <>
                    <Link href="/sos/hearing" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                      相談する
                    </Link>
                    <Link href="/sos/cases" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                      相談履歴
                    </Link>
                  </>
                )}

                <Link href="/profile" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                  {displayName || 'プロフィール'}
                </Link>

                <Button variant="outline" size="sm" onClick={handleLogout} className="text-gray-600 hover:text-red-600 hover:border-red-300">
                  ログアウト
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600">ログイン</Link>
                <Link href="/signup" className="text-sm bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-green-700">
                  新規登録
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}