'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* ロゴ */}
        <a href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            SDGs Match
          </span>
        </a>

        {/* ナビゲーション */}
        <nav className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-600 hover:border-red-300"
          >
            ログアウト
          </Button>
        </nav>
      </div>
    </header>
  );
}
