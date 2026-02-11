import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 本番環境のみパスワード保護
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  // DEV_PASSWORDが設定されていない場合はスキップ
  const devPassword = process.env.DEV_PASSWORD;
  if (!devPassword) {
    return NextResponse.next();
  }

  // パスワード入力ページ自体はスキップ
  const { pathname } = request.nextUrl;
  if (pathname === '/dev-login' || pathname.startsWith('/api/dev-auth')) {
    return NextResponse.next();
  }

  // Cookieで認証済み確認
  const authCookie = request.cookies.get('dev-auth');
  if (authCookie?.value === devPassword) {
    return NextResponse.next();
  }

  // パスワード入力ページへリダイレクト
  const url = request.nextUrl.clone();
  url.pathname = '/dev-login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
