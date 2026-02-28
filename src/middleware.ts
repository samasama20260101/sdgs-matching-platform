// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 本番パスワード保護
  if (process.env.NODE_ENV === 'production') {
    const devPassword = process.env.DEV_PASSWORD
    if (devPassword) {
      if (pathname !== '/dev-login' && !pathname.startsWith('/api/dev-auth')) {
        const authCookie = request.cookies.get('dev-auth')
        if (authCookie?.value !== devPassword) {
          const url = request.nextUrl.clone()
          url.pathname = '/dev-login'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}