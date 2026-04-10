// src/components/layout/Header.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Logo } from '@/components/icons/Logo';

type UserRole = 'SOS' | 'SUPPORTER' | 'ADMIN' | null;

export default function Header() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const navLinks = role ? [
    { href: getDashboardLink(), label: 'ダッシュボード' },
    ...(role === 'SOS' ? [
      { href: '/sos/hearing', label: '相談する' },
      { href: '/sos/cases', label: '相談履歴' },
    ] : []),
    { href: '/profile', label: displayName || 'プロフィール' },
    { href: '/contact', label: 'お問い合わせ' },
  ] : [
    { href: '/login', label: 'ログイン' },
    { href: '/signup', label: '新規登録' },
  ];

  return (
    <header className="w-full bg-white border-b border-gray-200 px-4 py-3 relative z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* ロゴ */}
        <Link href={getDashboardLink()} className="flex items-center">
          <Logo variant="default" size="sm" showText={true} />
        </Link>

        {/* PC用ナビ */}
        {!isLoading && (
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                {l.label}
              </Link>
            ))}
            {role && (
              <button onClick={handleLogout}
                className="text-sm border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 px-3 py-1.5 rounded-md transition-colors">
                ログアウト
              </button>
            )}
          </nav>
        )}

        {/* スマホ用ハンバーガー */}
        {!isLoading && (
          <button
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            <span className={`block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        )}
      </div>

      {/* スマホ用ドロップダウンメニュー */}
      {menuOpen && !isLoading && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg py-2">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href}
              className="block px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              onClick={() => setMenuOpen(false)}>
              {l.label}
            </Link>
          ))}
          {role && (
            <button onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="w-full text-left px-6 py-3 text-sm text-red-600 hover:bg-red-50">
              ログアウト
            </button>
          )}
        </div>
      )}
    </header>
  );
}
