import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'maintenance-bypass'

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 60 * 60,
    }
}

export async function GET(request: NextRequest) {
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN
    const providedToken = request.nextUrl.searchParams.get('token')
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'

    if (!bypassToken || providedToken !== bypassToken) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const url = new URL(redirectTo, request.nextUrl.origin)
    if (url.origin !== request.nextUrl.origin) {
        url.pathname = '/'
        url.search = ''
        url.hash = ''
    }
    const response = NextResponse.redirect(url)
    response.cookies.set(COOKIE_NAME, bypassToken, cookieOptions())
    return response
}

export async function DELETE() {
    const response = NextResponse.json({ ok: true })
    response.cookies.set(COOKIE_NAME, '', {
        ...cookieOptions(),
        maxAge: 0,
    })
    return response
}
